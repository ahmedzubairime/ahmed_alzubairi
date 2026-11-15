import {
  COURSES_CACHE_TAG,
  createCourseSchema,
  updateCourseSchema,
  type AdminCourse,
  type AdminCourseListResponse,
  type ContentStatus,
  type CourseType,
  type IdResponse,
  type Locale,
  type OkResponse,
  type UpdateCourse,
} from "@repo/shared";
import { trainingError, type TrainingError } from "@/lib/training/errors";
import type { AuditEntry } from "../audit";
import { baseError, type AdminError } from "../permissions";

/** A `courses` row as the server writes it. */
export type CourseWrite = {
  slug: string;
  type: CourseType;
  title_ar: string | null;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  audience_ar: string | null;
  audience_en: string | null;
  starts_at: string | null;
  place_ar: string | null;
  place_en: string | null;
  online_url: string | null;
  seats: number | null;
  status: ContentStatus;
};

/**
 * The database, behind an interface so tests can replace it. Created only
 * after `requirePermission(training.manage)` passed.
 */
export type CourseStore = {
  /** Every course with its registration count, read with the member's own client. */
  list: () => Promise<AdminCourse[]>;
  /** A course as stored, or null when there is no such row. */
  get: (id: string) => Promise<CourseWrite | null>;
  /** Inserts a row and returns its id, or `slug_taken`. */
  insert: (row: CourseWrite) => Promise<{ id: string } | "slug_taken">;
  /** Updates a row. `gone` when the row no longer exists. */
  update: (id: string, changes: Partial<CourseWrite>) => Promise<"ok" | "gone" | "slug_taken">;
  /** How many people registered for this course. */
  registrationCount: (id: string) => Promise<number>;
};

export type CourseDeps = {
  locale: Locale;
  userId: string;
  store: CourseStore;
  audit: (entry: AuditEntry) => Promise<void>;
  revalidate: (tag: string) => void;
};

type Result<Body> = { status: 200; body: Body } | AdminError | TrainingError;

/** The same rule as the content slugs in `packages/shared`: words joined by single hyphens. */
const SLUG_PATTERN = /^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u;

/** The types a client registers for, so they need a date (§6.7). */
const SCHEDULED_TYPES: readonly CourseType[] = ["in_person", "online_live"];

const filled = (value: string | null) => value !== null && value.trim() !== "";

/**
 * What a course must have to be published: a title and a description in at
 * least one language, and a start date when it is in person or live online.
 * A draft may miss any of them.
 */
function publishError(row: CourseWrite, locale: Locale): TrainingError | null {
  if (row.status !== "published") return null;
  const hasText =
    (filled(row.title_ar) && filled(row.description_ar)) ||
    (filled(row.title_en) && filled(row.description_en));
  if (!hasText) return trainingError("validation_failed", 400, "publishNeedsText", locale);
  if (SCHEDULED_TYPES.includes(row.type) && !row.starts_at) {
    return trainingError("validation_failed", 400, "publishNeedsDate", locale);
  }
  return null;
}

/** `GET /api/admin/courses`, after the permission check. */
export async function listCourses({
  store,
}: Pick<CourseDeps, "store">): Promise<{ status: 200; body: AdminCourseListResponse }> {
  return { status: 200, body: { courses: await store.list() } };
}

/** `POST /api/admin/courses`, after the permission check. */
export async function createCourse(
  rawBody: unknown,
  deps: CourseDeps,
): Promise<Result<IdResponse>> {
  const body = createCourseSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, deps.locale);
  const fields = body.data;
  if (!SLUG_PATTERN.test(fields.slug)) {
    return trainingError("validation_failed", 400, "slugInvalid", deps.locale);
  }

  const row: CourseWrite = {
    slug: fields.slug,
    type: fields.type,
    title_ar: fields.titleAr ?? null,
    title_en: fields.titleEn ?? null,
    description_ar: fields.descriptionAr ?? null,
    description_en: fields.descriptionEn ?? null,
    audience_ar: fields.audienceAr ?? null,
    audience_en: fields.audienceEn ?? null,
    starts_at: fields.startsAt ?? null,
    place_ar: fields.placeAr ?? null,
    place_en: fields.placeEn ?? null,
    online_url: fields.onlineUrl ?? null,
    seats: fields.seats ?? null,
    status: fields.status,
  };
  const refused = publishError(row, deps.locale);
  if (refused) return refused;

  const inserted = await deps.store.insert(row);
  if (inserted === "slug_taken") {
    return trainingError("conflict", 409, "slugTaken", deps.locale);
  }
  deps.revalidate(COURSES_CACHE_TAG);
  await deps.audit({
    actorId: deps.userId,
    action: "course.create",
    entity: "courses",
    entityId: inserted.id,
    metadata: { type: row.type, status: row.status },
  });
  return { status: 200, body: { id: inserted.id } };
}

/** Each request field and the column it writes. */
const COLUMNS = {
  slug: "slug",
  type: "type",
  titleAr: "title_ar",
  titleEn: "title_en",
  descriptionAr: "description_ar",
  descriptionEn: "description_en",
  audienceAr: "audience_ar",
  audienceEn: "audience_en",
  startsAt: "starts_at",
  placeAr: "place_ar",
  placeEn: "place_en",
  onlineUrl: "online_url",
  seats: "seats",
  status: "status",
} as const satisfies Record<Exclude<keyof UpdateCourse, "id">, keyof CourseWrite>;

type Field = keyof typeof COLUMNS;

/**
 * `PATCH /api/admin/courses`, after the permission check. `null` clears an
 * optional field. The publish rule is checked against the row as it will be,
 * so a published course can't lose what publishing needs, and the seat limit
 * can't drop below the people already registered.
 */
export async function updateCourse(
  rawBody: unknown,
  deps: CourseDeps,
): Promise<Result<OkResponse>> {
  const body = updateCourseSchema.safeParse(rawBody);
  if (!body.success) return baseError("validation_failed", 400, deps.locale);
  const { id, ...fields } = body.data;
  if (fields.slug !== undefined && !SLUG_PATTERN.test(fields.slug)) {
    return trainingError("validation_failed", 400, "slugInvalid", deps.locale);
  }

  const current = await deps.store.get(id);
  if (!current) return trainingError("not_found", 404, "notFound", deps.locale);

  const changed = (Object.keys(COLUMNS) as Field[]).filter((name) => fields[name] !== undefined);
  const changes = Object.fromEntries(
    changed.map((name) => [COLUMNS[name], fields[name]]),
  ) as Partial<CourseWrite>;
  const next: CourseWrite = { ...current, ...changes };

  const refused = publishError(next, deps.locale);
  if (refused) return refused;
  if (
    changes.seats !== undefined &&
    changes.seats !== null &&
    changes.seats < (await deps.store.registrationCount(id))
  ) {
    return trainingError("conflict", 409, "seatsBelowRegistrations", deps.locale);
  }

  const updated = await deps.store.update(id, changes);
  if (updated === "gone") return trainingError("not_found", 404, "notFound", deps.locale);
  if (updated === "slug_taken") return trainingError("conflict", 409, "slugTaken", deps.locale);

  deps.revalidate(COURSES_CACHE_TAG);
  await deps.audit({
    actorId: deps.userId,
    action: "course.update",
    entity: "courses",
    entityId: id,
    // Field names only: never a title or a link.
    metadata: { fields: changed, status: next.status },
  });
  return { status: 200, body: { ok: true } };
}
