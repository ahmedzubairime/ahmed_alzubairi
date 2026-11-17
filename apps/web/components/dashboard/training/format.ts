import {
  DEFAULT_PAGE_SIZE,
  type AdminCourse,
  type ContentStatus,
  type CourseType,
  type CreateCourse,
  type Locale,
  type UpdateCourse,
} from "@repo/shared";
import type { CourseDetail } from "@/lib/content/courses";

/**
 * Pure helpers for the Training section, with no directive: server pages and
 * client components both import them.
 */

export const TRAINING_BASE = "/dashboard/training";
export const REGISTRATIONS_PATH = `${TRAINING_BASE}/registrations`;
export const REQUESTS_PATH = `${TRAINING_BASE}/requests`;

export function coursePagePath(id: string): string {
  return `${TRAINING_BASE}/${encodeURIComponent(id)}`;
}

export function clientPagePath(id: string): string {
  return `/dashboard/clients/${encodeURIComponent(id)}`;
}

type ListLink = { page?: number; pageSize?: number; search?: string };

function withQuery(base: string, entries: [string, string | undefined][]): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

function listEntries(params: ListLink): [string, string | undefined][] {
  return [
    ["search", params.search],
    ["pageSize", params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE ? String(params.pageSize) : undefined],
    ["page", params.page && params.page > 1 ? String(params.page) : undefined],
  ];
}

/** The registrations list with these params; defaults are left out. */
export function registrationsPath(params: ListLink & { course?: string }): string {
  return withQuery(REGISTRATIONS_PATH, [["course", params.course], ...listEntries(params)]);
}

/** The custom requests list with these params; defaults are left out. */
export function requestsPath(params: ListLink): string {
  return withQuery(REQUESTS_PATH, listEntries(params));
}

/**
 * A search term as a regular expression that matches it letter for letter.
 * PostgREST turns every `*` in a like pattern into `%`, so a regex match is
 * used instead of `ilike`.
 */
export function literalPattern(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A value quoted for a PostgREST `or` list: commas and parentheses can't end it. */
export function quotedValue(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

/** The course's title in the page language, or the other one, or null. */
export function courseTitle(
  course: { titleAr: string | null; titleEn: string | null },
  locale: Locale,
): string | null {
  const [first, second] = locale === "ar" ? [course.titleAr, course.titleEn] : [course.titleEn, course.titleAr];
  return first?.trim() || second?.trim() || null;
}

/** The types a client registers for, so they need a date and may have seats (§6.7). */
export const SCHEDULED_TYPES: readonly CourseType[] = ["in_person", "online_live"];

const pad = (value: number) => String(value).padStart(2, "0");

/** A UTC time as the `date` and `time` inputs show it, in the browser's zone. */
export function toLocalInputs(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}

/** The `date` and `time` inputs, read in the browser's zone, as UTC ISO 8601. Null when unreadable. */
export function toUtc(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const at = new Date(`${date}T${time}`);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** What the course form edits. Every field is the text the input holds. */
export type CourseValues = {
  slug: string;
  type: CourseType;
  status: ContentStatus;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  audienceAr: string;
  audienceEn: string;
  placeAr: string;
  placeEn: string;
  onlineUrl: string;
  date: string;
  time: string;
  seats: string;
};

export function courseValues(course?: AdminCourse): CourseValues {
  const at = course?.startsAt ? toLocalInputs(course.startsAt) : { date: "", time: "" };
  return {
    slug: course?.slug ?? "",
    type: course?.type ?? "in_person",
    status: course?.status ?? "draft",
    titleAr: course?.titleAr ?? "",
    titleEn: course?.titleEn ?? "",
    descriptionAr: course?.descriptionAr ?? "",
    descriptionEn: course?.descriptionEn ?? "",
    audienceAr: course?.audienceAr ?? "",
    audienceEn: course?.audienceEn ?? "",
    placeAr: course?.placeAr ?? "",
    placeEn: course?.placeEn ?? "",
    onlineUrl: course?.onlineUrl ?? "",
    date: at.date,
    time: at.time,
    seats: course?.seats != null ? String(course.seats) : "",
  };
}

export type CourseField = "slug" | "titleAr" | "titleEn" | "descriptionAr" | "descriptionEn" | "date" | "time" | "onlineUrl" | "seats";

/** The message keys under `DashboardTraining.form.errors`. */
export type CourseProblem =
  | "required"
  | "slug"
  | "dateTime"
  | "https"
  | "seats"
  | "seatsBelow"
  | "publishText"
  | "publishDate";

const SLUG_PATTERN = /^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u;

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The form's problems, keyed by field, as the routes would find them. The
 * routes check everything again.
 */
export function courseProblems(
  values: CourseValues,
  registrationCount = 0,
): Partial<Record<CourseField, CourseProblem>> {
  const found: Partial<Record<CourseField, CourseProblem>> = {};
  const slug = values.slug.trim();
  if (!slug) found.slug = "required";
  else if (!SLUG_PATTERN.test(slug)) found.slug = "slug";

  const hasDate = values.date !== "" || values.time !== "";
  if (hasDate && !toUtc(values.date, values.time)) found.date = "dateTime";

  const url = values.onlineUrl.trim();
  if (url && !isHttps(url)) found.onlineUrl = "https";

  const seats = values.seats.trim();
  if (seats) {
    const number = Number(seats);
    if (!/^\d+$/.test(seats) || !Number.isSafeInteger(number) || number < 1) found.seats = "seats";
    else if (number < registrationCount) found.seats = "seatsBelow";
  }

  if (values.status === "published") {
    const ar = values.titleAr.trim() && values.descriptionAr.trim();
    const en = values.titleEn.trim() && values.descriptionEn.trim();
    if (!ar && !en) {
      // On the empty side of each language, so whichever is begun is finished.
      for (const [title, description] of [
        ["titleAr", "descriptionAr"],
        ["titleEn", "descriptionEn"],
      ] as const) {
        if (!values[title].trim()) found[title] = "publishText";
        if (!values[description].trim()) found[description] = "publishText";
      }
    }
    if (SCHEDULED_TYPES.includes(values.type) && !hasDate) found.date = "publishDate";
  }
  return found;
}

const text = (value: string) => {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** The values as the API stores them; null for an empty optional field. */
function stored(values: CourseValues) {
  return {
    slug: values.slug.trim(),
    type: values.type,
    status: values.status,
    titleAr: text(values.titleAr),
    titleEn: text(values.titleEn),
    descriptionAr: text(values.descriptionAr),
    descriptionEn: text(values.descriptionEn),
    audienceAr: text(values.audienceAr),
    audienceEn: text(values.audienceEn),
    placeAr: text(values.placeAr),
    placeEn: text(values.placeEn),
    onlineUrl: text(values.onlineUrl),
    startsAt: values.date || values.time ? toUtc(values.date, values.time) : null,
    seats: text(values.seats) === null ? null : Number(values.seats.trim()),
  };
}

/** `POST /api/admin/courses`: empty optional fields are left out. */
export function createBody(values: CourseValues): CreateCourse {
  const fields = stored(values);
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== null),
  ) as CreateCourse;
}

/**
 * `PATCH /api/admin/courses`: only the fields that differ from the saved
 * course, with null clearing one. Null when nothing changed. An unchanged
 * date and time keep the stored start to the second.
 */
export function updateBody(course: AdminCourse, values: CourseValues): UpdateCourse | null {
  const next = stored(values);
  const saved = courseValues(course);
  const before = stored(saved);
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof typeof next)[]) {
    if (key === "startsAt") {
      if (values.date !== saved.date || values.time !== saved.time) changes.startsAt = next.startsAt;
      continue;
    }
    if (next[key] !== before[key]) changes[key] = next[key];
  }
  return Object.keys(changes).length === 0 ? null : ({ id: course.id, ...changes } as UpdateCourse);
}

/**
 * The draft as the public course page would show it in one language, or null
 * when it isn't complete there (a title and a description). Seats left count
 * the people already registered.
 */
export function previewCourse(
  values: CourseValues,
  locale: Locale,
  registrationCount: number,
): CourseDetail | null {
  const fields = stored(values);
  const suffix = locale === "ar" ? "Ar" : "En";
  const title = fields[`title${suffix}`];
  const description = fields[`description${suffix}`];
  if (!title || !description) return null;
  const seats = fields.seats !== null && Number.isSafeInteger(fields.seats) && fields.seats > 0 ? fields.seats : null;
  const availableIn = (["ar", "en"] as const).filter((item) => {
    const end = item === "ar" ? "Ar" : "En";
    return Boolean(fields[`title${end}`] && fields[`description${end}`]);
  });
  return {
    id: "preview",
    slug: fields.slug,
    type: fields.type,
    title,
    description,
    audience: fields[`audience${suffix}`],
    startsAt: fields.startsAt,
    place: fields[`place${suffix}`],
    seats,
    seatsLeft: seats === null ? null : Math.max(seats - registrationCount, 0),
    availableIn,
  };
}
