import {
  COURSE_REGISTER_ERROR_CODES,
  COURSES_CACHE_TAG,
  courseRegisterOutcomeSchema,
  courseRegisterRequestSchema,
  customTrainingRequestSchema,
  EMAIL_ADMIN_PERMISSION,
  PERMISSIONS,
  uuidSchema,
  type CourseRegisterOutcome,
  type CourseRegisterResponse,
  type CustomTrainingRequest,
  type EmailEvent,
  type EmailPayload,
  type Locale,
  type LocalizedText,
  type OkResponse,
  type Permission,
} from "@repo/shared";
import { baseError } from "@/lib/admin/permissions";
import { formError, trainingError, type TrainingError } from "./errors";

/** Someone an email goes to, in their own language. */
export type Recipient = { userId: string; email: string; locale: Locale };

/** The caller's own profile, as registration needs it. */
export type OwnProfile = {
  fullName: string;
  email: string;
  locale: Locale;
  /** True for a client: a profile with no team role. */
  isClient: boolean;
  /** False when they turned non-essential emails off (§6.21). */
  notifyOptional: boolean;
};

/** What `register_for_course` refused with an error, not an outcome. */
export type RegisterRefusal = "not_a_client" | "course_not_found";

/**
 * The database, behind an interface so tests can replace it. `ownProfile`
 * reads through the caller's own client (RLS); everything else runs with the
 * service client, only after the route checked who is calling.
 */
export type TrainingStore = {
  ownProfile: () => Promise<OwnProfile | null>;
  /** `register_for_course`. The seat rule lives there, under a row lock. */
  register: (
    courseId: string,
    clientId: string,
  ) => Promise<{ outcome: CourseRegisterOutcome; seatsLeft: number | null } | RegisterRefusal>;
  /** The course's title in each language, or null when it has none at all. */
  courseTitle: (courseId: string) => Promise<LocalizedText | null>;
  /** Inserts a custom training request and returns its id. */
  insertCustomRequest: (
    request: CustomTrainingRequest,
    clientId: string | null,
  ) => Promise<string>;
  /** Every active member whose role holds any of these permissions, each once. */
  membersWith: (permissions: Permission[]) => Promise<Recipient[]>;
  /** One unread notification per user, for the dashboard counter. */
  notify: (
    userIds: string[],
    type: EmailEvent,
    target: { entity: string; entityId: string },
  ) => Promise<void>;
};

/** Queues one email (`lib/email/queue`). False when it couldn't be queued. */
export type QueueEmail = <Event extends EmailEvent>(input: {
  event: Event;
  to: { email: string; locale: Locale };
  payload: EmailPayload<Event>;
}) => Promise<boolean>;

/**
 * Queues one email per member holding a permission, with their notifications.
 * It skips members who turned an optional event off.
 */
export type QueueEmailForPermission = <Event extends EmailEvent>(
  event: Event,
  permission: Permission,
  payload: EmailPayload<Event>,
  target?: { entity: string; entityId: string },
) => Promise<boolean>;

export type TrainingDeps = {
  locale: Locale;
  store: TrainingStore;
  queueEmail: QueueEmail;
  queueEmailForPermission: QueueEmailForPermission;
  revalidate: (tag: string) => void;
};

type Result<Body> = { status: number; body: Body } | TrainingError;

/** Emails never fail the action that caused them (§6.21): log a label and go on. */
async function quietly(label: string, run: () => Promise<unknown>) {
  try {
    await run();
  } catch {
    console.error(`training: ${label} not queued`);
  }
}

/**
 * `POST /api/courses/:id/register`, after the session check (§6.7). The caller
 * needs a profile; `register_for_course` refuses anyone who isn't an active
 * client, and decides the seat under a row lock, so two people can't take the
 * last one.
 *
 * `registered` and `already_registered` are a 200. `full` and `closed` are a
 * 409 with their own error codes. Only a new registration sends the
 * `course_registration` email: to the trainee, and to every member with
 * `training.manage`, each unless they turned optional emails off.
 */
export async function registerForCourse(
  rawId: unknown,
  rawBody: unknown,
  deps: TrainingDeps & { userId: string },
): Promise<Result<CourseRegisterResponse>> {
  const id = uuidSchema.safeParse(rawId);
  if (!id.success) return trainingError("not_found", 404, "notFound", deps.locale);
  // The route takes no fields. A missing body counts as an empty one.
  if (!courseRegisterRequestSchema.safeParse(rawBody ?? {}).success) {
    return baseError("validation_failed", 400, deps.locale);
  }

  const profile = await deps.store.ownProfile();
  if (!profile) return trainingError("profile_incomplete", 422, "profileIncomplete", deps.locale);
  if (!profile.isClient) return trainingError("forbidden", 403, "notAClient", deps.locale);

  const result = await deps.store.register(id.data, deps.userId);
  if (result === "not_a_client") return trainingError("forbidden", 403, "notAClient", deps.locale);
  if (result === "course_not_found") return trainingError("not_found", 404, "notFound", deps.locale);

  if (result.outcome === "full") {
    return trainingError(COURSE_REGISTER_ERROR_CODES.full, 409, "courseFull", deps.locale);
  }
  if (result.outcome === "closed") {
    return trainingError(COURSE_REGISTER_ERROR_CODES.closed, 409, "courseClosed", deps.locale);
  }

  if (result.outcome === "registered") {
    // The public pages show the seats left.
    deps.revalidate(COURSES_CACHE_TAG);
    await quietly("course_registration", async () => {
      const courseTitle = await deps.store.courseTitle(id.data);
      if (!courseTitle) return;
      const payload = { courseTitle, traineeName: profile.fullName };
      if (profile.notifyOptional) {
        await deps.queueEmail({
          event: "course_registration",
          to: { email: profile.email, locale: profile.locale },
          payload,
        });
      }
      await deps.queueEmailForPermission(
        "course_registration",
        PERMISSIONS.TRAINING_MANAGE,
        payload,
        { entity: "courses", entityId: id.data },
      );
    });
  }

  return { status: 200, body: { outcome: result.outcome, seatsLeft: result.seatsLeft } };
}

/** Who hears of a custom training request: the admin and the coordinators (§6.21). */
const CUSTOM_REQUEST_PERMISSIONS: Permission[] = [
  EMAIL_ADMIN_PERMISSION,
  PERMISSIONS.TRAINING_MANAGE,
];

/**
 * `POST /api/training/custom-requests`, after Arcjet (§6.7). Signed in or not:
 * `clientId` is the caller when they are a signed-in client, else null. The
 * email carries the organization and the topic only, never the contact
 * address.
 */
export async function createCustomTrainingRequest(
  rawBody: unknown,
  deps: Pick<TrainingDeps, "locale" | "store" | "queueEmail"> & {
    clientId: string | null;
    /** Arcjet's email check. False refuses the address. */
    emailAccepted: (email: string) => Promise<boolean>;
  },
): Promise<Result<OkResponse>> {
  const body = customTrainingRequestSchema.safeParse(rawBody);
  if (!body.success) return formError("validation_failed", 400, deps.locale);
  if (!(await deps.emailAccepted(body.data.contactEmail))) {
    return formError("validation_failed", 400, deps.locale);
  }

  const requestId = await deps.store.insertCustomRequest(body.data, deps.clientId);

  await quietly("custom_training_request", async () => {
    const team = await deps.store.membersWith(CUSTOM_REQUEST_PERMISSIONS);
    for (const member of team) {
      await deps.queueEmail({
        event: "custom_training_request",
        to: member,
        payload: { orgName: body.data.orgName, topic: body.data.topic },
      });
    }
    await deps.store.notify(
      team.map((member) => member.userId),
      "custom_training_request",
      { entity: "custom_training_requests", entityId: requestId },
    );
  });

  return { status: 201, body: { ok: true } };
}

/** `register_for_course`'s outcome as the shared type, or a thrown error. */
export function parseOutcome(value: unknown): CourseRegisterOutcome {
  return courseRegisterOutcomeSchema.parse(value);
}
