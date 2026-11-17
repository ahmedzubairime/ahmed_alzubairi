import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "@repo/db";
import { COURSE_TYPES, courseTypeSchema, type CourseType, type Locale } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";

type Client = SupabaseClient<Database>;

/** The `?type=` filter of the training page, or null for every type. */
export function parseTypeFilter(value: string | string[] | undefined): CourseType | null {
  const one = Array.isArray(value) ? value[0] : value;
  return COURSE_TYPES.find((type) => type === one) ?? null;
}

/** An https link as stored, or null for anything else. */
function httpsLink(value: string | null): string | null {
  if (!value || !URL.canParse(value)) return null;
  return new URL(value).protocol === "https:" ? value : null;
}

/**
 * Who is looking at a course page, as far as registration goes:
 * - `signed_out`: no session.
 * - `no_profile`: signed in, onboarding not finished.
 * - `team`: a team member. Registration is for clients.
 * - `client`: with whether they are registered, and then the live session's
 *   link (only then: it is never public).
 */
export type Viewer =
  | { kind: "signed_out" }
  | { kind: "no_profile" }
  | { kind: "team" }
  | { kind: "client"; registered: boolean; onlineUrl: string | null };

export type ViewerDeps = {
  getUserId: () => Promise<string | null>;
  /** The caller's own token: RLS scopes every read made with it. */
  user: () => Client;
  /** Used only after `user` has shown the caller is registered. */
  service: () => Client;
};

const defaultDeps: ViewerDeps = {
  getUserId: async () => (await auth()).userId,
  user: createUserClient,
  service: createServiceClient,
};

/**
 * The viewer of one course. The profile and the registration are read with
 * the viewer's own token (RLS: their own rows). The online link is read with
 * the service client only once that proved they are registered; a client has
 * no grant on `courses`.
 */
export async function readViewer(courseId: string, deps: ViewerDeps = defaultDeps): Promise<Viewer> {
  const userId = await deps.getUserId();
  if (!userId) return { kind: "signed_out" };
  const user = deps.user();

  const profile = await user
    .from("profiles")
    .select("role_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (profile.error) throw new Error(`profile read failed: ${profile.error.code}`);
  if (!profile.data) return { kind: "no_profile" };
  if (profile.data.role_id !== null) return { kind: "team" };

  const registration = await user
    .from("course_registrations")
    .select("id")
    .eq("course_id", courseId)
    .eq("client_id", userId)
    .maybeSingle();
  if (registration.error) {
    throw new Error(`registration read failed: ${registration.error.code}`);
  }
  if (!registration.data) return { kind: "client", registered: false, onlineUrl: null };

  const course = await deps
    .service()
    .from("courses")
    .select("online_url")
    .eq("id", courseId)
    .maybeSingle();
  if (course.error) throw new Error(`course read failed: ${course.error.code}`);
  return { kind: "client", registered: true, onlineUrl: httpsLink(course.data?.online_url ?? null) };
}

/** One row of "دوراتي": a registration with its course, in one language. */
export type MyCourse = {
  id: string;
  courseId: string;
  /** The public page's slug, or null when the course is no longer published. */
  slug: string | null;
  type: CourseType;
  title: string;
  /** UTC. */
  startsAt: string | null;
  place: string | null;
  /** The live session's link. The viewer is registered, so they may have it. */
  onlineUrl: string | null;
  registeredAt: string;
};

type CourseRow = {
  id: string;
  slug: string;
  type: string;
  title_ar: string | null;
  title_en: string | null;
  starts_at: string | null;
  place_ar: string | null;
  place_en: string | null;
  online_url: string | null;
  status: string;
};

const filled = (value: string | null) => (value && value.trim() !== "" ? value : null);

/**
 * The client's registrations, soonest course first, then the undated ones.
 * The registrations come through the client's own token, so RLS returns only
 * theirs; the filter keeps a team member's page to their own too. The courses
 * are then read by those ids with the service client: a client has no grant
 * on `courses`, and being registered is what entitles them to the row.
 */
export async function readMyCourses(
  userId: string,
  locale: Locale,
  deps: Pick<ViewerDeps, "user" | "service"> = defaultDeps,
): Promise<MyCourse[]> {
  const registrations = await deps
    .user()
    .from("course_registrations")
    .select("id, course_id, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false });
  if (registrations.error) {
    throw new Error(`own registrations read failed: ${registrations.error.code}`);
  }
  if (registrations.data.length === 0) return [];

  const courses = await deps
    .service()
    .from("courses")
    .select("id, slug, type, title_ar, title_en, starts_at, place_ar, place_en, online_url, status")
    .in(
      "id",
      registrations.data.map((row) => row.course_id),
    );
  if (courses.error) throw new Error(`courses read failed: ${courses.error.code}`);
  const byId = new Map((courses.data as CourseRow[]).map((row) => [row.id, row]));
  const other = locale === "ar" ? "en" : "ar";

  const rows = registrations.data.flatMap((registration): MyCourse[] => {
    const course = byId.get(registration.course_id);
    const type = courseTypeSchema.safeParse(course?.type);
    // The other language's title stands in when this one is empty.
    const title = course && (filled(course[`title_${locale}`]) ?? filled(course[`title_${other}`]));
    if (!course || !type.success || !title) return [];
    return [
      {
        id: registration.id,
        courseId: course.id,
        slug: course.status === "published" ? course.slug : null,
        type: type.data,
        title,
        startsAt: course.starts_at === null ? null : new Date(course.starts_at).toISOString(),
        place: filled(course[`place_${locale}`]) ?? filled(course[`place_${other}`]),
        onlineUrl: httpsLink(course.online_url),
        registeredAt: new Date(registration.created_at).toISOString(),
      },
    ];
  });
  return rows.sort((a, b) => {
    if (a.startsAt === b.startsAt) return b.registeredAt.localeCompare(a.registeredAt);
    if (a.startsAt === null) return 1;
    if (b.startsAt === null) return -1;
    return a.startsAt.localeCompare(b.startsAt);
  });
}
