import { COURSES_CACHE_TAG, PERMISSIONS, type AdminCourse, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/TrainingErrors.json";
import en from "@/messages/en/TrainingErrors.json";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import {
  createCourse,
  updateCourse,
  type CourseDeps,
  type CourseStore,
  type CourseWrite,
} from "./handlers";
import { handleCoursesRequest, type CoursesRouteDeps } from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const COORDINATOR = "user_coordinator";
const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const NEW_ID = "223e4567-e89b-42d3-a456-426614174001";
const MISSING = "923e4567-e89b-42d3-a456-426614174009";
const STARTS = "2027-03-01T09:00:00.000Z";

const stored = (rest: Partial<CourseWrite> = {}): CourseWrite => ({
  slug: "governance-basics",
  type: "in_person",
  title_ar: "أساسيات الحوكمة",
  title_en: null,
  description_ar: "وصف",
  description_en: null,
  audience_ar: null,
  audience_en: null,
  starts_at: STARTS,
  place_ar: "عدن",
  place_en: null,
  online_url: null,
  seats: 10,
  status: "published",
  ...rest,
});

const LISTED: AdminCourse = {
  id: COURSE_ID,
  slug: "governance-basics",
  type: "in_person",
  titleAr: "أساسيات الحوكمة",
  titleEn: null,
  descriptionAr: "وصف",
  descriptionEn: null,
  audienceAr: null,
  audienceEn: null,
  startsAt: STARTS,
  placeAr: "عدن",
  placeEn: null,
  onlineUrl: null,
  seats: 10,
  status: "published",
  registrationCount: 4,
};

function memoryStore(row: CourseWrite = stored(), registered = 4) {
  const rows = new Map<string, CourseWrite>([[COURSE_ID, row]]);
  const taken = (slug: string, exceptId?: string) =>
    [...rows].some(([id, other]) => id !== exceptId && other.slug === slug);
  return {
    rows,
    list: vi.fn(async () => [LISTED]),
    get: vi.fn(async (id: string) => rows.get(id) ?? null),
    insert: vi.fn(async (added: CourseWrite) => {
      if (taken(added.slug)) return "slug_taken" as const;
      rows.set(NEW_ID, added);
      return { id: NEW_ID };
    }),
    update: vi.fn(async (id: string, changes: Partial<CourseWrite>) => {
      const current = rows.get(id);
      if (!current) return "gone" as const;
      if (changes.slug && taken(changes.slug, id)) return "slug_taken" as const;
      rows.set(id, { ...current, ...changes });
      return "ok" as const;
    }),
    registrationCount: vi.fn(async () => registered),
  } satisfies CourseStore & { rows: unknown };
}

function deps(store = memoryStore(), locale: "ar" | "en" = "en") {
  return {
    locale,
    userId: COORDINATOR,
    store,
    audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
    revalidate: vi.fn<(tag: string) => void>(),
  } satisfies CourseDeps;
}

const DRAFT = { slug: "new-course", type: "online_live", status: "draft" };
const PUBLISHABLE = {
  ...DRAFT,
  status: "published",
  titleEn: "New course",
  descriptionEn: "About it",
  startsAt: STARTS,
  onlineUrl: "https://meet.example/abc",
  seats: 20,
};

describe("createCourse", () => {
  it("saves a draft with only a slug and a type", async () => {
    const d = deps();
    expect(await createCourse(DRAFT, d)).toEqual({ status: 200, body: { id: NEW_ID } });
    expect(d.store.rows.get(NEW_ID)).toMatchObject({
      slug: "new-course",
      type: "online_live",
      status: "draft",
      title_ar: null,
      starts_at: null,
      seats: null,
    });
  });

  it("publishes a full course, refreshes the tag and writes the audit row", async () => {
    const d = deps();
    expect((await createCourse(PUBLISHABLE, d)).status).toBe(200);
    expect(d.store.rows.get(NEW_ID)).toMatchObject({
      title_en: "New course",
      online_url: "https://meet.example/abc",
      seats: 20,
      status: "published",
    });
    expect(d.revalidate).toHaveBeenCalledWith(COURSES_CACHE_TAG);
    expect(d.audit).toHaveBeenCalledWith({
      actorId: COORDINATOR,
      action: "course.create",
      entity: "courses",
      entityId: NEW_ID,
      metadata: { type: "online_live", status: "published" },
    });
  });

  it.each([
    ["no text at all", { titleEn: undefined, descriptionEn: undefined }, "publishNeedsText"],
    ["a title without its description", { descriptionEn: undefined }, "publishNeedsText"],
    [
      "the title and the description in different languages",
      { descriptionEn: undefined, descriptionAr: "وصف" },
      "publishNeedsText",
    ],
    ["no start date on a live course", { startsAt: undefined }, "publishNeedsDate"],
  ] as const)("refuses to publish with %s", async (_label, change, key) => {
    const d = deps();
    const result = await createCourse({ ...PUBLISHABLE, ...change }, d);
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en[key] } },
    });
    expect(d.store.insert).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });

  it.each(["recorded", "custom"])("publishes a %s course without a date", async (type) => {
    const result = await createCourse({ ...PUBLISHABLE, type, startsAt: undefined }, deps());
    expect(result.status).toBe(200);
  });

  it.each([
    ["an http link", { onlineUrl: "http://meet.example/abc" }],
    ["a javascript link", { onlineUrl: "javascript:alert(1)" }],
    ["zero seats", { seats: 0 }],
    ["an unknown type", { type: "webinar" }],
    ["an unknown field", { registrationCount: 0 }],
    ["no slug", { slug: undefined }],
  ])("refuses %s", async (_label, change) => {
    const d = deps();
    const result = await createCourse({ ...PUBLISHABLE, ...change }, d);
    expect(result.status).toBe(400);
    expect(d.store.insert).not.toHaveBeenCalled();
  });

  it.each(["Two Words", "trailing-", "a--b", "a/b", "../x"])("refuses the slug %j", async (slug) => {
    const result = await createCourse({ ...DRAFT, slug }, deps(undefined, "ar"));
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: ar.slugInvalid } },
    });
  });

  it("takes an Arabic slug, and answers 409 for one in use", async () => {
    const d = deps();
    expect((await createCourse({ ...DRAFT, slug: "أساسيات-الحوكمة" }, d)).status).toBe(200);
    const taken = await createCourse({ ...DRAFT, slug: "governance-basics" }, d);
    expect(taken).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.slugTaken } },
    });
  });
});

describe("updateCourse", () => {
  it("changes the given fields only, and audits their names without their values", async () => {
    const d = deps();
    const result = await updateCourse({ id: COURSE_ID, titleEn: "Governance basics", seats: 12 }, d);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(d.store.update).toHaveBeenCalledWith(COURSE_ID, { title_en: "Governance basics", seats: 12 });
    expect(d.revalidate).toHaveBeenCalledWith(COURSES_CACHE_TAG);
    expect(d.audit).toHaveBeenCalledWith({
      actorId: COORDINATOR,
      action: "course.update",
      entity: "courses",
      entityId: COURSE_ID,
      metadata: { fields: ["titleEn", "seats"], status: "published" },
    });
    expect(JSON.stringify(d.audit.mock.calls)).not.toContain("Governance basics");
  });

  it("null clears an optional field: no seat limit", async () => {
    const d = deps();
    expect((await updateCourse({ id: COURSE_ID, seats: null }, d)).status).toBe(200);
    expect(d.store.rows.get(COURSE_ID)?.seats).toBeNull();
    // Removing the limit never needs the registration count.
    expect(d.store.registrationCount).not.toHaveBeenCalled();
  });

  it.each([
    ["its only description", { descriptionAr: null }, "publishNeedsText"],
    ["its start date", { startsAt: null }, "publishNeedsDate"],
  ] as const)("a published course can't lose %s", async (_label, change, key) => {
    const d = deps();
    const result = await updateCourse({ id: COURSE_ID, ...change }, d);
    expect(result).toEqual({
      status: 400,
      body: { error: { code: "validation_failed", message: en[key] } },
    });
    expect(d.store.update).not.toHaveBeenCalled();
  });

  it("the same change is fine once it is a draft, or in the same request", async () => {
    const d = deps();
    expect((await updateCourse({ id: COURSE_ID, status: "draft", startsAt: null }, d)).status).toBe(200);
    expect((await updateCourse({ id: COURSE_ID, descriptionAr: null }, d)).status).toBe(200);
    // And publishing it again is refused until it is complete.
    expect((await updateCourse({ id: COURSE_ID, status: "published" }, d)).status).toBe(400);
  });

  it("a recorded course can drop its date while published", async () => {
    const d = deps(memoryStore(stored({ type: "recorded" })));
    expect((await updateCourse({ id: COURSE_ID, startsAt: null }, d)).status).toBe(200);
  });

  it("the seat limit can't go below the people registered", async () => {
    const d = deps(memoryStore(stored(), 4));
    expect(await updateCourse({ id: COURSE_ID, seats: 3 }, d)).toEqual({
      status: 409,
      body: { error: { code: "conflict", message: en.seatsBelowRegistrations } },
    });
    expect(d.store.update).not.toHaveBeenCalled();
    expect((await updateCourse({ id: COURSE_ID, seats: 4 }, d)).status).toBe(200);
  });

  it.each([
    ["a missing course", { id: MISSING, seats: 5 }, 404],
    ["no field besides the id", { id: COURSE_ID }, 400],
    ["a bad id", { id: "1", seats: 5 }, 400],
    ["an http link", { id: COURSE_ID, onlineUrl: "http://meet.example" }, 400],
    ["a null status", { id: COURSE_ID, status: null }, 400],
    ["a bad slug", { id: COURSE_ID, slug: "a b" }, 400],
  ])("refuses %s", async (_label, body, status) => {
    const d = deps();
    expect((await updateCourse(body, d)).status).toBe(status);
    expect(d.store.update).not.toHaveBeenCalled();
    expect(d.audit).not.toHaveBeenCalled();
  });

  it("answers 404 when the course is deleted mid-request, and 409 for a slug in use", async () => {
    const d = deps();
    d.store.update.mockResolvedValueOnce("gone");
    expect((await updateCourse({ id: COURSE_ID, seats: 12 }, d)).status).toBe(404);
    d.store.update.mockResolvedValueOnce("slug_taken");
    expect((await updateCourse({ id: COURSE_ID, slug: "other" }, d)).status).toBe(409);
    expect(d.audit).not.toHaveBeenCalled();
  });
});

describe("/api/admin/courses", () => {
  function routeDeps(userId: string | null, held: Permission[]) {
    const store = memoryStore();
    const permission: PermissionDeps = {
      getUserId: async () => userId,
      hasPermission: vi.fn(async (key: Permission) => held.includes(key)),
    };
    const createStore = vi.fn(() => store);
    const routeDeps: CoursesRouteDeps = {
      permission,
      createStore,
      audit: vi.fn(async () => {}),
      revalidate: vi.fn(),
    };
    return { routeDeps, store, permission, createStore };
  }

  const call = (method: string, body?: unknown) =>
    new Request("https://site.example/api/admin/courses", {
      method,
      headers: { referer: "https://site.example/en/dashboard/training" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it.each(["GET", "POST", "PATCH"])("%s answers 401 when signed out", async (method) => {
    const { routeDeps: d, createStore } = routeDeps(null, []);
    const response = await handleCoursesRequest(call(method, method === "GET" ? undefined : DRAFT), d);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(createStore).not.toHaveBeenCalled();
  });

  it.each(["GET", "POST", "PATCH"])(
    "%s answers 403 without training.manage, whatever else the member holds",
    async (method) => {
      const others = Object.values(PERMISSIONS).filter((key) => key !== PERMISSIONS.TRAINING_MANAGE);
      const { routeDeps: d, createStore, permission } = routeDeps("user_editor", others);
      const response = await handleCoursesRequest(
        call(method, method === "GET" ? undefined : { ...DRAFT, id: COURSE_ID }),
        d,
      );
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden");
      expect(permission.hasPermission).toHaveBeenCalledWith(PERMISSIONS.TRAINING_MANAGE);
      // Nothing is read or written before the check passes.
      expect(createStore).not.toHaveBeenCalled();
      expect(d.audit).not.toHaveBeenCalled();
    },
  );

  it("with training.manage: GET lists, POST creates, PATCH updates", async () => {
    const { routeDeps: d, store } = routeDeps(COORDINATOR, [PERMISSIONS.TRAINING_MANAGE]);
    const list = await handleCoursesRequest(call("GET"), d);
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ courses: [LISTED] });

    const made = await handleCoursesRequest(call("POST", DRAFT), d);
    expect(await made.json()).toEqual({ id: NEW_ID });

    const patched = await handleCoursesRequest(call("PATCH", { id: COURSE_ID, seats: 15 }), d);
    expect(await patched.json()).toEqual({ ok: true });
    expect(store.rows.get(COURSE_ID)?.seats).toBe(15);
    expect(d.audit).toHaveBeenCalledTimes(2);
  });

  it("answers 400 for a broken body and 500, with no details, when the store throws", async () => {
    const { routeDeps: d, store } = routeDeps(COORDINATOR, [PERMISSIONS.TRAINING_MANAGE]);
    const broken = new Request("https://site.example/api/admin/courses", { method: "POST", body: "{" });
    expect((await handleCoursesRequest(broken, d)).status).toBe(400);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    store.list.mockRejectedValueOnce(new Error("courses read failed: 57014"));
    const response = await handleCoursesRequest(call("GET"), d);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("57014");
    errors.mockRestore();
  });
});
