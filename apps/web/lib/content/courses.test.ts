import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client returns every fixture row for the table and ignores filters
 * and order, so each rule below must hold in `courses.ts` itself.
 */
type Query = { table: string; columns: string; filters: [string, unknown][]; signal?: AbortSignal };

const db = vi.hoisted(() => ({
  courses: [] as Record<string, unknown>[],
  registrations: [] as { course_id: string }[],
  queries: [] as Query[],
  fail: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query: Query = { table, columns: "", filters: [] };
      db.queries.push(query);
      const builder = {
        select: (columns: string) => ((query.columns = columns), builder),
        eq: (column: string, value: unknown) => (query.filters.push([column, value]), builder),
        in: (column: string, value: unknown) => (query.filters.push([column, value]), builder),
        order: () => builder,
        limit: () => builder,
        abortSignal: (signal: AbortSignal) => ((query.signal = signal), builder),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(
            db.fail || query.signal?.aborted
              ? { data: null, error: { code: "PGRST000" } }
              : { data: table === "courses" ? db.courses : db.registrations, error: null },
          ).then(resolve, reject),
      };
      return builder;
    },
  }),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const { courseState, getCourse, getCourses, hasCourse } = await import("./courses");
const { cacheTag } = await import("next/cache");

function course(id: string, fields: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    type: "in_person",
    title_ar: `دورة ${id}`,
    title_en: `Course ${id}`,
    description_ar: "وصف",
    description_en: "Description",
    audience_ar: null,
    audience_en: "Managers",
    starts_at: "2027-03-01T09:00:00+00:00",
    place_ar: "عدن",
    place_en: "Aden",
    online_url: "https://meet.example/secret",
    seats: 10,
    status: "published",
    ...fields,
  };
}

beforeEach(() => {
  db.courses = [];
  db.registrations = [];
  db.queries = [];
  db.fail = false;
  vi.mocked(cacheTag).mockClear();
});

describe("getCourses", () => {
  it("lists published courses that have a title and a description in the language", async () => {
    db.courses = [
      course("both"),
      course("draft", { status: "draft" }),
      course("arabic-only", { title_en: null, description_en: null }),
      course("no-description", { description_en: "  " }),
      course("odd-type", { type: "webinar" }),
    ];
    expect((await getCourses("en")).map((item) => item.slug)).toEqual(["both"]);
    expect((await getCourses("ar")).map((item) => item.slug)).toEqual([
      "arabic-only",
      "both",
      "no-description",
    ]);
  });

  it("returns one language, UTC dates, and never the online link or the status", async () => {
    db.courses = [course("c1")];
    const [item] = await getCourses("en");
    expect(item).toEqual({
      id: "c1",
      slug: "c1",
      type: "in_person",
      title: "Course c1",
      description: "Description",
      audience: "Managers",
      startsAt: "2027-03-01T09:00:00.000Z",
      place: "Aden",
      seats: 10,
      seatsLeft: 10,
    });
    expect(JSON.stringify(await getCourses("ar"))).not.toContain("meet.example");
    for (const query of db.queries.filter((q) => q.table === "courses")) {
      expect(query.columns).not.toContain("online_url");
      expect(query.columns).not.toContain("*");
      expect(query.filters).toContainEqual(["status", "published"]);
    }
  });

  it("counts seats left from the registrations, never below zero, null with no limit", async () => {
    db.courses = [course("a", { seats: 2 }), course("b", { seats: 1 }), course("c", { seats: null })];
    db.registrations = [
      { course_id: "a" },
      { course_id: "b" },
      { course_id: "b" },
      { course_id: "c" },
      { course_id: "other" },
    ];
    const seats = Object.fromEntries((await getCourses("en")).map((item) => [item.slug, item.seatsLeft]));
    expect(seats).toEqual({ a: 1, b: 0, c: null });
    // Only the course id is read from registrations: no client.
    const read = db.queries.find((q) => q.table === "course_registrations");
    expect(read?.columns).toBe("course_id");
  });

  it("puts dated courses first, soonest first, then the undated ones", async () => {
    db.courses = [
      course("recorded", { type: "recorded", starts_at: null }),
      course("later", { starts_at: "2027-06-01T09:00:00+00:00" }),
      course("sooner", { starts_at: "2027-02-01T09:00:00+00:00" }),
    ];
    expect((await getCourses("en")).map((item) => item.slug)).toEqual(["sooner", "later", "recorded"]);
  });

  it("is cached under the courses tag, and throws when the read fails", async () => {
    await getCourses("en");
    expect(cacheTag).toHaveBeenCalledWith("content:courses");
    db.fail = true;
    await expect(getCourses("en")).rejects.toThrow(/courses failed/);
  });
});

describe("getCourse", () => {
  it("returns the course with its seats left and its languages", async () => {
    db.courses = [course("c1", { seats: 3, title_ar: null })];
    db.registrations = [{ course_id: "c1" }];
    const detail = await getCourse("c1", "en");
    expect(detail).toMatchObject({ slug: "c1", seatsLeft: 2, availableIn: ["en"] });
    expect(JSON.stringify(detail)).not.toContain("meet.example");
  });

  it.each([
    ["another slug", "other", "en", {}],
    ["a draft", "c1", "en", { status: "draft" }],
    ["a language it isn't in", "c1", "ar", { title_ar: null }],
  ])("is null for %s", async (_label, slug, locale, fields) => {
    db.courses = [course("c1", fields)];
    expect(await getCourse(slug, locale as "ar" | "en")).toBeNull();
  });
});

describe("hasCourse", () => {
  it("agrees with getCourse, reads only what the rule needs, and passes the signal on", async () => {
    db.courses = [course("c1", { title_ar: null })];
    const controller = new AbortController();
    expect(await hasCourse("c1", "en", controller.signal)).toBe(true);
    expect(await hasCourse("c1", "ar")).toBe(false);
    expect(await hasCourse("nope", "en")).toBe(false);
    const [first] = db.queries;
    expect(first?.columns).toBe("slug, type, status, title_en, description_en");
    expect(first?.signal).toBe(controller.signal);
    expect(cacheTag).not.toHaveBeenCalled();
  });

  it("throws when the lookup is cancelled", async () => {
    db.courses = [course("c1")];
    const controller = new AbortController();
    controller.abort();
    await expect(hasCourse("c1", "en", controller.signal)).rejects.toThrow();
  });
});

describe("courseState", () => {
  const now = new Date("2027-01-01T00:00:00.000Z");
  const future = "2027-02-01T00:00:00.000Z";
  it.each([
    ["a recorded course", { type: "recorded", startsAt: null, seatsLeft: null }, "soon"],
    ["a custom course", { type: "custom", startsAt: future, seatsLeft: null }, "closed"],
    ["no date", { type: "in_person", startsAt: null, seatsLeft: 5 }, "closed"],
    ["a past date", { type: "online_live", startsAt: "2026-12-31T23:59:59.000Z", seatsLeft: 5 }, "closed"],
    ["the date being now", { type: "in_person", startsAt: now.toISOString(), seatsLeft: 5 }, "closed"],
    ["no seats left", { type: "in_person", startsAt: future, seatsLeft: 0 }, "full"],
    ["seats left", { type: "online_live", startsAt: future, seatsLeft: 1 }, "open"],
    ["no seat limit", { type: "in_person", startsAt: future, seatsLeft: null }, "open"],
  ] as const)("%s is %s", (_label, input, state) => {
    expect(courseState(input, now)).toBe(state);
  });
});
