import "server-only";
import {
  COURSES_CACHE_TAG,
  courseTypeSchema,
  LOCALES,
  type CourseType,
  type Locale,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { rowsOrThrow, text } from "./rows";

/**
 * Public reads of `courses` (§6.7), under the same rules as the rest of
 * `lib/content`: published rows only, explicit columns, one language, cached
 * by tag. The courses admin routes and every new registration refresh
 * `COURSES_CACHE_TAG`, so the seats left stay current.
 *
 * `online_url` is never returned: a live session's link is for the people
 * registered, who get it in their account, not for every visitor.
 */

/** A course in one language, as the public pages show it. */
export type Course = {
  id: string;
  slug: string;
  type: CourseType;
  title: string;
  description: string;
  audience: string | null;
  /** UTC. Null for a course with no date (a recorded or custom one). */
  startsAt: string | null;
  place: string | null;
  /** The seat limit, or null when there is none. */
  seats: number | null;
  /** Seats still free, never below zero. Null when there is no limit. */
  seatsLeft: number | null;
};

export type CourseDetail = Course & {
  /** The languages this course is public in, for the language switch (§6.1). */
  availableIn: Locale[];
};

/**
 * What the course page offers (§6.7):
 * - `soon`: a recorded course, shown with the "قريباً" badge and nothing else.
 * - `open`: the register button.
 * - `full`: "اكتملت المقاعد".
 * - `ended`: the date passed: "انتهت الدورة", no register button.
 * - `closed`: no registration (a custom course, or one with no date).
 */
export type CourseState = "soon" | "open" | "full" | "ended" | "closed";

const COLUMNS =
  "id, slug, type, title_ar, title_en, description_ar, description_en, audience_ar, audience_en, starts_at, place_ar, place_en, seats, status";

type CourseRow = Record<string, unknown> & {
  id: string;
  slug: string;
  type: string;
  starts_at: string | null;
  seats: number | null;
  status: string;
};

/**
 * The one rule for "public in this language", shared by every read below:
 * published, with a title and a description in that language. It matches what
 * the admin route asks for before publishing.
 */
function isListed(row: Record<string, unknown>, locale: Locale) {
  return (
    row.status === "published" &&
    text(row, "title", locale) !== null &&
    text(row, "description", locale) !== null
  );
}

function toCourse(row: CourseRow, locale: Locale, taken: number): Course | null {
  const type = courseTypeSchema.safeParse(row.type);
  const title = text(row, "title", locale);
  const description = text(row, "description", locale);
  if (!isListed(row, locale) || !type.success || !title || !description) return null;
  return {
    id: row.id,
    slug: row.slug,
    type: type.data,
    title,
    description,
    audience: text(row, "audience", locale),
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    place: text(row, "place", locale),
    seats: row.seats,
    seatsLeft: row.seats === null ? null : Math.max(row.seats - taken, 0),
  };
}

/** How many people registered for each of these courses. Counts only: no client data. */
async function registrationCounts(courseIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (courseIds.length === 0) return counts;
  const rows = rowsOrThrow<{ course_id: string }>(
    await createServiceClient()
      .from("course_registrations")
      .select("course_id")
      .in("course_id", courseIds),
    "course_registrations",
  );
  for (const row of rows) {
    if (courseIds.includes(row.course_id)) {
      counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * True while a course belongs on the training page: it has no date, or its
 * date hasn't come yet. The same instant `courseState` calls ended is out.
 */
export function isUpcoming(course: Pick<Course, "startsAt">, now: Date = new Date()): boolean {
  return course.startsAt === null || new Date(course.startsAt).getTime() > now.getTime();
}

/**
 * Courses in this language for the training page (§6.7): dated ones first,
 * soonest first, then the ones with no date. A course whose date has passed
 * isn't listed; its own page still opens and shows it ended.
 *
 * The read is cached for hours, so "has the date passed" is decided here, out
 * of the cache, at `now`.
 */
export async function getCourses(locale: Locale, now: Date = new Date()): Promise<Course[]> {
  return (await getAllCourses(locale)).filter((course) => isUpcoming(course, now));
}

/** Every public course in this language, past ones included. Cached by tag. */
async function getAllCourses(locale: Locale): Promise<Course[]> {
  "use cache";
  cacheTag(COURSES_CACHE_TAG);
  cacheLife("hours");

  const rows = rowsOrThrow<CourseRow>(
    await createServiceClient()
      .from("courses")
      .select(COLUMNS)
      .eq("status", "published")
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("slug"),
    "courses",
  ).filter((row) => isListed(row, locale));
  const counts = await registrationCounts(rows.map((row) => row.id));
  return rows
    .flatMap((row) => toCourse(row, locale, counts.get(row.id) ?? 0) ?? [])
    .sort((a, b) => {
      if (a.startsAt === b.startsAt) return a.slug.localeCompare(b.slug);
      if (a.startsAt === null) return 1;
      if (b.startsAt === null) return -1;
      return a.startsAt.localeCompare(b.startsAt);
    });
}

/** One course by slug with its seats left, or null when it isn't public in this language. */
export async function getCourse(slug: string, locale: Locale): Promise<CourseDetail | null> {
  "use cache";
  cacheTag(COURSES_CACHE_TAG);
  cacheLife("hours");

  const row = rowsOrThrow<CourseRow>(
    await createServiceClient()
      .from("courses")
      .select(COLUMNS)
      .eq("slug", slug)
      .eq("status", "published")
      .limit(1),
    "courses",
  ).find((item) => item.slug === slug);
  if (!row || !isListed(row, locale)) return null;
  const counts = await registrationCounts([row.id]);
  const course = toCourse(row, locale, counts.get(row.id) ?? 0);
  if (!course) return null;
  return { ...course, availableIn: LOCALES.filter((other) => isListed(row, other)) };
}

/**
 * The languages a course row is public in, by the same rule as `getCourse`.
 * For the sitemap: the row needs `type`, `status`, `title_*` and `description_*`.
 */
export function courseLocales(row: Record<string, unknown>): Locale[] {
  if (!courseTypeSchema.safeParse(row.type).success) return [];
  return LOCALES.filter((locale) => isListed(row, locale));
}

/**
 * True when `getCourse` would return this slug in this language. Not cached,
 * so the proxy can call it: a `"use cache"` function throws there. It reads
 * one row and only the columns the rule needs.
 * A given `signal` cancels the query, and the call then throws.
 */
export async function hasCourse(
  slug: string,
  locale: Locale,
  signal?: AbortSignal,
): Promise<boolean> {
  const query = createServiceClient()
    .from("courses")
    .select(`slug, type, status, title_${locale}, description_${locale}`)
    .eq("slug", slug)
    .eq("status", "published")
    .limit(1);
  const rows = rowsOrThrow<Record<string, unknown>>(
    await (signal ? query.abortSignal(signal) : query),
    "courses",
  );
  return rows.some(
    (row) =>
      row.slug === slug &&
      isListed(row, locale) &&
      courseTypeSchema.safeParse(row.type).success,
  );
}

/**
 * What a course offers at `now`. Pure and uncached on purpose: the cached
 * reads above can be hours old, and "has the date passed" must not be. It
 * mirrors `register_for_course`, which makes the real decision.
 */
export function courseState(
  course: Pick<Course, "type" | "startsAt" | "seatsLeft">,
  now: Date = new Date(),
): CourseState {
  if (course.type === "recorded") return "soon";
  if (course.type === "custom") return "closed";
  if (!course.startsAt) return "closed";
  if (!isUpcoming(course, now)) return "ended";
  if (course.seatsLeft !== null && course.seatsLeft <= 0) return "full";
  return "open";
}
