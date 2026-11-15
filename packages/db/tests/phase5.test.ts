import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { COURSE_REGISTER_OUTCOMES, EMAIL_EVENTS } from "../../shared/index";
import { createTestDb, type ApiRole, type TestDb } from "../supabase-pglite";

/**
 * The Phase 5 migration: register_for_course (§6.7, seats under a row lock),
 * the widened email_templates.event check, and the unique storage key.
 */

const uuid = (n: number) =>
  `123e4567-e89b-42d3-a456-4266141743${String(n).padStart(2, "0")}`;
const ONE_SEAT = uuid(1);
const TWO_SEATS = uuid(2);
const UNLIMITED = uuid(3);
const DRAFT = uuid(4);
const RECORDED = uuid(5);
const CUSTOM = uuid(6);
const PAST = uuid(7);
const NO_DATE = uuid(8);
const MISSING = uuid(99);
const NO_EXECUTE = /permission denied for function/;

type Result = { outcome: string; seats_left: number | null };

let db: TestDb;

async function addProfile(clerkUserId: string, roleKey: string | null, status = "active") {
  await db.owner.query(
    `insert into public.profiles
       (clerk_user_id, full_name, email, phone, timezone, terms_accepted_at, status, locale, role_id)
     values ($1, 'Test', $1 || '@example.com', '+966500000000', 'Asia/Riyadh', now(), $2, 'ar',
       (select id from public.roles where key = $3))`,
    [clerkUserId, status, roleKey],
  );
}

async function addCourse(
  id: string,
  {
    type = "in_person",
    status = "published",
    startsAt = "now() + interval '7 days'",
    seats = null as number | null,
  } = {},
) {
  await db.owner.query(
    `insert into public.courses (id, slug, type, title_ar, status, starts_at, seats)
     values ($1::uuid, $1::text, $2, 'دورة', $3, ${startsAt}, $4)`,
    [id, type, status, seats],
  );
}

async function register(courseId: string, clientId: string): Promise<Result> {
  return db.runAs("service_role", null, async (tx) => {
    const { rows } = await tx.query<Result>(
      "select * from public.register_for_course($1, $2)",
      [courseId, clientId],
    );
    expect(rows).toHaveLength(1);
    return rows[0] as Result;
  });
}

const registrations = async (courseId: string) =>
  (
    await db.owner.query<{ client_id: string }>(
      "select client_id from public.course_registrations where course_id = $1 order by client_id",
      [courseId],
    )
  ).rows.map((row) => row.client_id);

beforeAll(async () => {
  db = await createTestDb();
  for (const client of ["client_a", "client_b", "client_c"]) await addProfile(client, null);
  await addProfile("client_off", null, "disabled");
  await addProfile("member", "admin");

  await addCourse(ONE_SEAT, { seats: 1 });
  await addCourse(TWO_SEATS, { type: "online_live", seats: 2 });
  await addCourse(UNLIMITED);
  await addCourse(DRAFT, { status: "draft" });
  await addCourse(RECORDED, { type: "recorded" });
  await addCourse(CUSTOM, { type: "custom" });
  await addCourse(PAST, { startsAt: "now() - interval '1 hour'" });
  await addCourse(NO_DATE, { startsAt: "null" });
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.owner.exec("delete from public.course_registrations");
});

describe("register_for_course", () => {
  it("answers only the shared outcomes", () => {
    expect(COURSE_REGISTER_OUTCOMES).toEqual(["registered", "already_registered", "full", "closed"]);
  });

  it("two callers racing for the last seat: exactly one is registered", async () => {
    // PGlite has one connection, so the two transactions queue rather than
    // overlap; the row lock is what serializes them on Postgres (checked below).
    const results = await Promise.all([
      register(ONE_SEAT, "client_a"),
      register(ONE_SEAT, "client_b"),
    ]);
    expect(results.map((r) => r.outcome).sort()).toEqual(["full", "registered"]);
    expect(results.every((r) => r.seats_left === 0)).toBe(true);
    expect(await registrations(ONE_SEAT)).toHaveLength(1);
  });

  it("locks the course row before counting", async () => {
    const { rows } = await db.owner.query<{ src: string }>(
      "select prosrc as src from pg_proc where proname = 'register_for_course'",
    );
    const src = rows[0]?.src ?? "";
    expect(src).toMatch(/from public\.courses c[\s\S]*?for update/);
    expect(src.indexOf("for update")).toBeLessThan(src.indexOf("count(*)"));
  });

  it("counts seats down and refuses once they're gone", async () => {
    expect(await register(TWO_SEATS, "client_a")).toEqual({ outcome: "registered", seats_left: 1 });
    expect(await register(TWO_SEATS, "client_b")).toEqual({ outcome: "registered", seats_left: 0 });
    expect(await register(TWO_SEATS, "client_c")).toEqual({ outcome: "full", seats_left: 0 });
    expect(await registrations(TWO_SEATS)).toEqual(["client_a", "client_b"]);
  });

  it("has no seats left to report on a course without a limit", async () => {
    expect(await register(UNLIMITED, "client_a")).toEqual({ outcome: "registered", seats_left: null });
  });

  it("a second call is already_registered, not an error, and adds no row", async () => {
    await register(TWO_SEATS, "client_a");
    expect(await register(TWO_SEATS, "client_a")).toEqual({
      outcome: "already_registered",
      seats_left: 1,
    });
    // Even once the course is full.
    await register(ONE_SEAT, "client_a");
    expect((await register(ONE_SEAT, "client_a")).outcome).toBe("already_registered");
    expect(await registrations(TWO_SEATS)).toEqual(["client_a"]);
  });

  it.each([
    ["a draft", DRAFT],
    ["a recorded", RECORDED],
    ["a custom", CUSTOM],
    ["a past", PAST],
    ["an undated", NO_DATE],
  ])("%s course is closed", async (_label, courseId) => {
    expect((await register(courseId, "client_a")).outcome).toBe("closed");
    expect(await registrations(courseId)).toEqual([]);
  });

  it("refuses a missing course", async () => {
    await expect(register(MISSING, "client_a")).rejects.toThrow("course_not_found");
  });

  it.each([
    ["a team member", "member"],
    ["a disabled client", "client_off"],
    ["an unknown user", "nobody"],
  ])("refuses %s", async (_label, clientId) => {
    await expect(register(UNLIMITED, clientId)).rejects.toThrow("not_a_client");
    expect(await registrations(UNLIMITED)).toEqual([]);
  });

  it.each(["anon", "authenticated"] as ApiRole[])("can't be executed by %s", async (role) => {
    await expect(
      db.runAs(role, role === "authenticated" ? "client_a" : null, (tx) =>
        tx.query("select * from public.register_for_course($1, $2)", [UNLIMITED, "client_a"]),
      ),
    ).rejects.toThrow(NO_EXECUTE);
    expect(await registrations(UNLIMITED)).toEqual([]);
  });

  it("is SECURITY INVOKER with an empty search_path, executable by service_role only", async () => {
    const { rows } = await db.owner.query<{
      prosecdef: boolean;
      proconfig: string[] | null;
      anon: boolean;
      authenticated: boolean;
      service: boolean;
      public: boolean;
    }>(
      `select p.prosecdef, p.proconfig,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
              has_function_privilege('service_role', p.oid, 'execute') as service,
              exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0) as public
         from pg_proc p where p.proname = 'register_for_course'`,
    );
    expect(rows).toEqual([
      {
        prosecdef: false,
        proconfig: ['search_path=""'],
        anon: false,
        authenticated: false,
        service: true,
        public: false,
      },
    ]);
  });
});

describe("email_templates.event", () => {
  it("takes newsletter_confirm and still every earlier event", async () => {
    for (const event of EMAIL_EVENTS) {
      await db.owner.query(
        `insert into public.email_templates (event, subject_ar, subject_en, body_ar, body_en)
         values ($1, 'a', 'b', 'c', 'd') on conflict (event) do nothing`,
        [event],
      );
    }
    await expect(
      db.owner.query(
        "insert into public.email_templates (event, subject_ar, subject_en, body_ar, body_en) values ('nope', 'a', 'b', 'c', 'd')",
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("documents.storage_key", () => {
  it("is unique", async () => {
    const insert = (id: string) =>
      db.owner.query(
        `insert into public.documents (id, category, title_ar, title_en, storage_key, mime, access_mode, status)
         values ($1, 'event_photo', 'a', 'b', 'same/key.pdf', 'application/pdf', 'view', 'draft')`,
        [id],
      );
    await insert(uuid(50));
    await expect(insert(uuid(51))).rejects.toThrow(/duplicate key/);
  });
});
