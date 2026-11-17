import "server-only";
import type { Database } from "@repo/db";
import {
  courseRegistrationListParamsSchema,
  customTrainingRequestListParamsSchema,
  LOCALES,
  pageRange,
  PERMISSIONS,
  type AdminCourse,
  type CourseRegistrationListParams,
  type CustomTrainingRequestListParams,
  type Locale,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { grantedPermissions } from "@/components/dashboard/access";
import { createCourseStore } from "@/lib/admin/courses/store";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { literalPattern, quotedValue } from "./format";

type Client = SupabaseClient<Database>;
type RawParams = Record<string, string | string[] | undefined>;

export type TrainingAccess = {
  locale: Locale;
  /** `training.manage`: the section opens. */
  allowed: boolean;
  /** `data.delete`: the delete control shows. The route checks it again. */
  canDelete: boolean;
};

const TRAINING_KEYS = [PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.DATA_DELETE];

/**
 * Who may open the Training section, decided on the server with
 * `has_permission`. Pages call `requireTeamMember` first, then this, and show
 * `<Refusal />` when `allowed` is false.
 */
export async function trainingAccess(
  params: Promise<{ locale: string }>,
  check: typeof grantedPermissions = grantedPermissions,
): Promise<TrainingAccess> {
  const { locale: raw } = await params;
  // requireTeamMember already sent unknown locales to "not found".
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const granted = await check(TRAINING_KEYS, locale);
  return {
    locale,
    allowed: granted.has(PERMISSIONS.TRAINING_MANAGE),
    canDelete: granted.has(PERMISSIONS.DATA_DELETE),
  };
}

/**
 * Every course with its registration count, read with the member's own
 * client (RLS: `training.manage`), the same read `GET /api/admin/courses` makes.
 */
export function loadCourses(): Promise<AdminCourse[]> {
  // The service client is never used for this read; the store takes it for its writes.
  return createCourseStore(createUserClient(), createServiceClient()).list();
}

/** One course, or null when there is none or RLS doesn't show it. */
export async function loadCourse(id: string): Promise<AdminCourse | null> {
  return (await loadCourses()).find((course) => course.id === id) ?? null;
}

/**
 * Params from the page's query string. Only the known keys are read, and a
 * value the schema refuses falls back to its default, so a bad link still
 * opens the list.
 */
function parseParams<Schema extends { safeParse: (value: unknown) => { success: boolean }; parse: (value: unknown) => Output }, Output>(
  schema: Schema,
  keys: readonly string[],
  raw: RawParams,
): Output {
  const kept = Object.fromEntries(
    keys.flatMap((key) => {
      const value = raw[key];
      const one = Array.isArray(value) ? value[0] : value;
      if (one === undefined || one.trim() === "") return [];
      return schema.safeParse({ [key]: one }).success ? [[key, one]] : [];
    }),
  );
  return schema.parse(kept);
}

export function parseRegistrationParams(raw: RawParams): CourseRegistrationListParams {
  return parseParams(courseRegistrationListParamsSchema, ["page", "pageSize", "search", "course"], raw);
}

export function parseRequestParams(raw: RawParams): CustomTrainingRequestListParams {
  return parseParams(customTrainingRequestListParamsSchema, ["page", "pageSize", "search"], raw);
}

/** One registration as the dashboard lists it. */
export type RegistrationRow = {
  id: string;
  createdAt: string;
  clientId: string;
  /** Null when RLS doesn't show the client's profile. */
  name: string | null;
  email: string | null;
  courseId: string;
  courseTitleAr: string | null;
  courseTitleEn: string | null;
};

/**
 * One page of registrations, newest first, read with the member's own client:
 * RLS shows them with `training.manage`, and the client's name and email
 * through the scoped-client rule (§5). `search` matches the name or email,
 * letter for letter; `course` keeps one course.
 */
export async function loadRegistrations(
  params: CourseRegistrationListParams,
  client: Client = createUserClient(),
): Promise<{ registrations: RegistrationRow[]; total: number }> {
  const { from, to } = pageRange(params);
  // A search needs the profile, so it joins inner; otherwise a row whose
  // profile RLS hides still counts and shows without a name.
  const select = params.search
    ? "id, created_at, client_id, course_id, client:profiles!course_registrations_client_id_fkey!inner(full_name, email), course:courses!course_registrations_course_id_fkey(title_ar, title_en)"
    : "id, created_at, client_id, course_id, client:profiles!course_registrations_client_id_fkey(full_name, email), course:courses!course_registrations_course_id_fkey(title_ar, title_en)";
  let query = client.from("course_registrations").select(select, { count: "exact" });
  if (params.course) query = query.eq("course_id", params.course);
  if (params.search) {
    const value = quotedValue(literalPattern(params.search));
    query = query.or(`full_name.imatch.${value},email.imatch.${value}`, { referencedTable: "client" });
  }
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new Error(`course_registrations read failed: ${error.code}`);

  const rows = (data as unknown as RawRegistration[]).map(
    (row): RegistrationRow => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      clientId: row.client_id,
      name: row.client?.full_name ?? null,
      email: row.client?.email ?? null,
      courseId: row.course_id,
      courseTitleAr: row.course?.title_ar ?? null,
      courseTitleEn: row.course?.title_en ?? null,
    }),
  );
  return { registrations: rows, total: count ?? rows.length };
}

type RawRegistration = {
  id: string;
  created_at: string;
  client_id: string;
  course_id: string;
  client: { full_name: string; email: string } | null;
  course: { title_ar: string | null; title_en: string | null } | null;
};

/** One custom training request as the dashboard lists it. Every field is shown as text. */
export type CustomRequestRow = {
  id: string;
  createdAt: string;
  orgName: string;
  traineeCount: number;
  topic: string;
  /** A calendar date (`YYYY-MM-DD`), with no time zone. */
  suggestedDate: string;
  place: string | null;
  contactEmail: string;
  /** The account that sent it, when there is one and RLS shows its profile. */
  clientId: string | null;
};

/**
 * One page of custom training requests, newest first, read with the member's
 * own client (RLS: `training.manage`). `search` matches the organization's
 * name, letter for letter.
 */
export async function loadCustomRequests(
  params: CustomTrainingRequestListParams,
  client: Client = createUserClient(),
): Promise<{ requests: CustomRequestRow[]; total: number }> {
  const { from, to } = pageRange(params);
  // The client's profile only to know RLS shows it, so the page links to it.
  let query = client
    .from("custom_training_requests")
    .select(
      "id, created_at, org_name, trainee_count, topic, suggested_date, place, contact_email, client:profiles!custom_training_requests_client_id_fkey(clerk_user_id)",
      { count: "exact" },
    );
  if (params.search) query = query.filter("org_name", "imatch", literalPattern(params.search));
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (error) throw new Error(`custom_training_requests read failed: ${error.code}`);
  const requests = data.map(
    (row): CustomRequestRow => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      orgName: row.org_name,
      traineeCount: row.trainee_count,
      topic: row.topic,
      suggestedDate: row.suggested_date,
      place: row.place,
      contactEmail: row.contact_email,
      clientId: row.client?.clerk_user_id ?? null,
    }),
  );
  return { requests, total: count ?? requests.length };
}

/** The days the dashboard's "registrations" count looks back. */
export const NEW_REGISTRATION_DAYS = 7;

/**
 * Registrations made in the last `NEW_REGISTRATION_DAYS` days, read with the
 * member's own client. Call it only for a member with `training.manage`.
 */
export async function loadNewRegistrationCount(
  now: Date = new Date(),
  client: Client = createUserClient(),
): Promise<number> {
  const since = new Date(now.getTime() - NEW_REGISTRATION_DAYS * 24 * 60 * 60 * 1000);
  const { count, error } = await client
    .from("course_registrations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  if (error) throw new Error(`course_registrations count failed: ${error.code}`);
  return count ?? 0;
}
