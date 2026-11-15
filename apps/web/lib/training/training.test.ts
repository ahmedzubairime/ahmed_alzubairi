import { COURSES_CACHE_TAG, PERMISSIONS } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/TrainingErrors.json";
import en from "@/messages/en/TrainingErrors.json";
import type { OwnProfile, Recipient, TrainingStore } from "./handlers";
import {
  CUSTOM_REQUEST_LIMIT,
  handleCustomRequest,
  handleRegister,
  type TrainingRouteDeps,
} from "./route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/arcjet", () => ({ protectForm: vi.fn(), validateFormEmail: vi.fn() }));
vi.mock("@/lib/email/queue", () => ({ queueEmail: vi.fn(), queueEmailForPermission: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const CLIENT = "user_client";
const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const REQUEST_ID = "323e4567-e89b-42d3-a456-426614174002";
const TITLE = { ar: "أساسيات الحوكمة", en: "Governance basics" };

const profile = (rest: Partial<OwnProfile> = {}): OwnProfile => ({
  fullName: "Mona Ali",
  email: "mona@example.com",
  locale: "ar",
  isClient: true,
  notifyOptional: true,
  ...rest,
});

const ADMIN: Recipient = { userId: "user_admin", email: "admin@example.com", locale: "ar" };
const COORDINATOR: Recipient = { userId: "user_coord", email: "coord@example.com", locale: "en" };

type Setup = {
  userId?: string | null;
  profile?: OwnProfile | null;
  register?: Awaited<ReturnType<TrainingStore["register"]>>;
  team?: Recipient[];
};

function setup({
  userId = CLIENT,
  profile: own = profile(),
  register = { outcome: "registered", seatsLeft: 4 },
  team = [ADMIN, COORDINATOR],
}: Setup = {}) {
  const store = {
    ownProfile: vi.fn(async () => own),
    register: vi.fn(async () => register),
    courseTitle: vi.fn(async (): Promise<typeof TITLE | null> => TITLE),
    insertCustomRequest: vi.fn(async () => REQUEST_ID),
    membersWith: vi.fn<TrainingStore["membersWith"]>(async () => team),
    notify: vi.fn(async () => {}),
  } satisfies TrainingStore;
  const deps = {
    getUserId: vi.fn(async () => userId),
    createStore: vi.fn<TrainingRouteDeps["createStore"]>(() => store),
    protect: vi.fn(async () => "allow" as const),
    validateEmail: vi.fn(async () => true),
    queueEmail: vi.fn(async () => true),
    queueEmailForPermission: vi.fn(async () => true),
    revalidate: vi.fn(),
  } satisfies TrainingRouteDeps;
  return { store, deps };
}

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // No log line carries an address, a name or an organization.
  for (const call of errors.mock.calls) {
    expect(call.join(" ")).not.toMatch(/example\.com|Mona|Sample Foundation/);
  }
  errors.mockRestore();
});

describe("POST /api/courses/:id/register", () => {
  const post = (body?: string, referer = "https://site.example/en/training/governance-basics") =>
    new Request(`https://site.example/api/courses/${COURSE_ID}/register`, {
      method: "POST",
      headers: { referer },
      body,
    });

  it("answers 401 when signed out, before anything is read", async () => {
    const { deps, store } = setup({ userId: null });
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(deps.createStore).not.toHaveBeenCalled();
    expect(store.register).not.toHaveBeenCalled();
  });

  it("registers a client: 200 with the seats left, fresh pages, and both emails", async () => {
    const { deps, store } = setup();
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "registered", seatsLeft: 4 });
    // The session's user, never an id from the request.
    expect(store.register).toHaveBeenCalledWith(COURSE_ID, CLIENT);
    expect(deps.revalidate).toHaveBeenCalledWith(COURSES_CACHE_TAG);

    const payload = { courseTitle: TITLE, traineeName: "Mona Ali" };
    expect(deps.queueEmail).toHaveBeenCalledTimes(1);
    expect(deps.queueEmail).toHaveBeenCalledWith({
      event: "course_registration",
      to: { email: "mona@example.com", locale: "ar" },
      payload,
    });
    expect(deps.queueEmailForPermission).toHaveBeenCalledTimes(1);
    expect(deps.queueEmailForPermission).toHaveBeenCalledWith(
      "course_registration",
      PERMISSIONS.TRAINING_MANAGE,
      payload,
      { entity: "courses", entityId: COURSE_ID },
    );
  });

  it("a trainee who turned optional emails off gets none; the coordinators still do", async () => {
    const { deps } = setup({ profile: profile({ notifyOptional: false }) });
    expect((await handleRegister(post("{}"), COURSE_ID, deps)).status).toBe(200);
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.queueEmailForPermission).toHaveBeenCalledTimes(1);
  });

  it("already_registered is a 200 with no email and no refresh", async () => {
    const { deps } = setup({ register: { outcome: "already_registered", seatsLeft: 0 } });
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "already_registered", seatsLeft: 0 });
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.queueEmailForPermission).not.toHaveBeenCalled();
    expect(deps.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    ["full", "course_full", "courseFull"],
    ["closed", "course_closed", "courseClosed"],
  ] as const)("a %s course is a 409 with its own code, and no email", async (outcome, code, key) => {
    const { deps } = setup({ register: { outcome, seatsLeft: 0 } });
    const response = await handleRegister(post(undefined, "https://site.example/ar/training/x"), COURSE_ID, deps);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code, message: ar[key] } });
    expect(deps.queueEmail).not.toHaveBeenCalled();
    expect(deps.queueEmailForPermission).not.toHaveBeenCalled();
  });

  it("the full message is the Arabic copy §6.7 gives", () => {
    expect(ar.courseFull).toBe("اكتملت المقاعد");
  });

  it("needs a profile", async () => {
    const { deps, store } = setup({ profile: null });
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "profile_incomplete", message: en.profileIncomplete },
    });
    expect(store.register).not.toHaveBeenCalled();
  });

  it.each([
    ["a team member", { profile: profile({ isClient: false }) }, false],
    ["anyone the function refuses (a disabled client)", { register: "not_a_client" as const }, true],
  ])("refuses %s with 403", async (_label, options, reachedFunction) => {
    const { deps, store } = setup(options);
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "forbidden", message: en.notAClient } });
    expect(store.register).toHaveBeenCalledTimes(reachedFunction ? 1 : 0);
    expect(deps.queueEmailForPermission).not.toHaveBeenCalled();
  });

  it.each([
    ["a course that doesn't exist", COURSE_ID, { register: "course_not_found" as const }],
    ["an id that isn't a uuid", "governance-basics", {}],
  ])("answers 404 for %s", async (_label, id, options) => {
    const { deps } = setup(options);
    const response = await handleRegister(post(), id, deps);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toEqual({ code: "not_found", message: en.notFound });
  });

  it.each([["a field", '{"clientId":"user_other"}'], ["a broken body", "{"]])(
    "refuses %s: the route takes none",
    async (_label, body) => {
      const { deps, store } = setup();
      expect((await handleRegister(post(body), COURSE_ID, deps)).status).toBe(400);
      expect(store.register).not.toHaveBeenCalled();
    },
  );

  it("a failed email never fails the registration", async () => {
    const { deps, store } = setup();
    store.courseTitle.mockRejectedValue(new Error("courses read failed: 57014"));
    expect((await handleRegister(post(), COURSE_ID, deps)).status).toBe(200);
    store.courseTitle.mockResolvedValue(null);
    expect((await handleRegister(post(), COURSE_ID, deps)).status).toBe(200);
    expect(deps.queueEmail).not.toHaveBeenCalled();
  });

  it("answers 500 with no details when the function fails", async () => {
    const { deps, store } = setup();
    store.register.mockRejectedValue(new Error("register_for_course failed: 57014"));
    const response = await handleRegister(post(), COURSE_ID, deps);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("57014");
  });
});

describe("POST /api/training/custom-requests", () => {
  const VALID = {
    orgName: "Sample Foundation",
    traineeCount: 25,
    topic: "Project management",
    suggestedDate: "2027-04-10",
    place: "Aden",
    contactEmail: "training@example.com",
  };
  const post = (body: unknown, referer = "https://site.example/en/training") =>
    new Request("https://site.example/api/training/custom-requests", {
      method: "POST",
      headers: { "content-type": "application/json", referer },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("a visitor's request is saved with no client, and the admin and coordinators hear once each", async () => {
    const { deps, store } = setup({ userId: null });
    const response = await handleCustomRequest(post(VALID), deps);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
    expect(store.insertCustomRequest).toHaveBeenCalledWith(VALID, null);
    expect(store.ownProfile).not.toHaveBeenCalled();

    expect(store.membersWith).toHaveBeenCalledWith([
      PERMISSIONS.TEAM_MANAGE,
      PERMISSIONS.TRAINING_MANAGE,
    ]);
    expect(deps.queueEmail).toHaveBeenCalledTimes(2);
    for (const member of [ADMIN, COORDINATOR]) {
      expect(deps.queueEmail).toHaveBeenCalledWith({
        event: "custom_training_request",
        to: member,
        // The organization and the topic only: never the contact address.
        payload: { orgName: "Sample Foundation", topic: "Project management" },
      });
    }
    expect(store.notify).toHaveBeenCalledWith(
      ["user_admin", "user_coord"],
      "custom_training_request",
      { entity: "custom_training_requests", entityId: REQUEST_ID },
    );
  });

  it("a signed-in client's request carries their id; a team member's doesn't", async () => {
    const asClient = setup();
    await handleCustomRequest(post(VALID), asClient.deps);
    expect(asClient.store.insertCustomRequest).toHaveBeenCalledWith(VALID, CLIENT);

    const asMember = setup({ profile: profile({ isClient: false }) });
    await handleCustomRequest(post(VALID), asMember.deps);
    expect(asMember.store.insertCustomRequest).toHaveBeenCalledWith(VALID, null);

    const noProfile = setup({ profile: null });
    await handleCustomRequest(post(VALID), noProfile.deps);
    expect(noProfile.store.insertCustomRequest).toHaveBeenCalledWith(VALID, null);
  });

  it("a failed session or profile read never blocks the form", async () => {
    const { deps, store } = setup();
    deps.getUserId.mockRejectedValueOnce(new Error("clerk down"));
    expect((await handleCustomRequest(post(VALID), deps)).status).toBe(201);
    store.ownProfile.mockRejectedValueOnce(new Error("profile read failed: 57014"));
    expect((await handleCustomRequest(post(VALID), deps)).status).toBe(201);
    expect(store.insertCustomRequest).toHaveBeenLastCalledWith(VALID, null);
  });

  it("runs Arcjet first, with its own limit", async () => {
    const { deps, store } = setup();
    await handleCustomRequest(post(VALID), deps);
    expect(deps.protect).toHaveBeenCalledWith(expect.any(Request), CUSTOM_REQUEST_LIMIT);
    expect(CUSTOM_REQUEST_LIMIT).toEqual({ route: "training-custom-requests", window: "10m", max: 5 });

    for (const [decision, status, code] of [
      ["rate_limited", 429, "rate_limited"],
      ["denied", 403, "forbidden"],
    ] as const) {
      store.insertCustomRequest.mockClear();
      deps.protect.mockResolvedValueOnce(decision as never);
      const response = await handleCustomRequest(post(VALID, "https://site.example/ar/training"), deps);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { code, message: ar.form[code] } });
      expect(store.insertCustomRequest).not.toHaveBeenCalled();
      expect(deps.getUserId).toHaveBeenCalledTimes(1);
    }
  });

  it.each([
    ["no organization", { orgName: " " }],
    ["zero trainees", { traineeCount: 0 }],
    ["a fractional count", { traineeCount: 2.5 }],
    ["a count as text", { traineeCount: "25" }],
    ["no topic", { topic: undefined }],
    ["a date that isn't one", { suggestedDate: "next month" }],
    ["a date with a time", { suggestedDate: "2027-04-10T10:00:00Z" }],
    ["a bad email", { contactEmail: "not-an-email" }],
    ["an empty place", { place: "" }],
    ["an unknown field", { clientId: "user_other" }],
  ])("refuses %s", async (_label, change) => {
    const { deps, store } = setup();
    const response = await handleCustomRequest(post({ ...VALID, ...change }), deps);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_failed", message: en.form.validation_failed },
    });
    expect(store.insertCustomRequest).not.toHaveBeenCalled();
    expect(deps.queueEmail).not.toHaveBeenCalled();
    // A body the schema refuses never reaches Arcjet's email check.
    expect(deps.validateEmail).not.toHaveBeenCalled();
  });

  it("refuses a broken body, and an address Arcjet refuses", async () => {
    const { deps, store } = setup();
    expect((await handleCustomRequest(post("{"), deps)).status).toBe(400);
    deps.validateEmail.mockResolvedValueOnce(false);
    expect((await handleCustomRequest(post(VALID), deps)).status).toBe(400);
    expect(deps.validateEmail).toHaveBeenCalledWith(
      expect.any(Request),
      "training@example.com",
      "training-custom-requests",
    );
    expect(store.insertCustomRequest).not.toHaveBeenCalled();
  });

  it("the place is optional", async () => {
    const { deps, store } = setup({ userId: null });
    const { place: _place, ...withoutPlace } = VALID;
    void _place;
    expect((await handleCustomRequest(post(withoutPlace), deps)).status).toBe(201);
    expect(store.insertCustomRequest).toHaveBeenCalledWith(withoutPlace, null);
  });

  it("a failed email never fails the request; a failed insert is a 500", async () => {
    const { deps, store } = setup({ userId: null });
    store.membersWith.mockRejectedValueOnce(new Error("profiles read failed: 57014"));
    expect((await handleCustomRequest(post(VALID), deps)).status).toBe(201);
    store.insertCustomRequest.mockRejectedValueOnce(new Error("insert failed: 57014"));
    const response = await handleCustomRequest(post(VALID), deps);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: en.form.internal_error },
    });
  });
});
