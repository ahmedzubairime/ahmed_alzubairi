import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNewsletterDb, type SubscriberRow } from "@/lib/newsletter/fake-db";
import { hashConfirmToken } from "@/lib/newsletter/token";
import ar from "@/messages/ar/Newsletter.json";
import en from "@/messages/en/Newsletter.json";

/**
 * Both newsletter routes over the real `lib/newsletter`, with the database,
 * the email queue, Resend and Arcjet replaced.
 */

const mocks = vi.hoisted(() => ({
  protect: vi.fn(),
  queue: vi.fn(),
  create: vi.fn(),
}));

let rows: SubscriberRow[];
const db: { fail?: { code: string; message: string } } = {};

// Outside a request `connection()` has nothing to wait for.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/lib/arcjet", () => ({ protectForm: mocks.protect }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeNewsletterDb(rows, db),
}));
vi.mock("@/lib/email/queue", () => ({ queueEmail: mocks.queue }));
vi.mock("@/lib/email/resend", () => ({
  getMailer: () => ({
    from: "x",
    resend: { contacts: { create: mocks.create, update: vi.fn(), segments: { add: vi.fn() } } },
  }),
}));

const subscribe = await import("./subscribe/route");
const confirm = await import("./confirm/route");

const EMAIL = "reader@example.com";
const row = (rest: Partial<SubscriberRow> = {}): SubscriberRow => ({
  email: EMAIL,
  status: "pending",
  confirm_token_hash: hashConfirmToken("good-token"),
  locale: "en",
  source: "footer",
  consented_at: "2026-11-01T00:00:00.000Z",
  ...rest,
});

beforeEach(() => {
  rows = [];
  db.fail = undefined;
  mocks.protect.mockReset().mockResolvedValue("allow");
  mocks.queue.mockReset().mockResolvedValue(true);
  mocks.create.mockReset().mockResolvedValue({ data: { id: "c" }, error: null });
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example");
  vi.stubEnv("RESEND_AUDIENCE_ID", "seg_1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/newsletter/subscribe", () => {
  const post = (body: unknown, referer = "https://site.example/en/blog") =>
    subscribe.POST(
      new Request("https://site.example/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json", referer },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  const VALID = { email: EMAIL, locale: "en", source: "footer" };

  it("gives the same answer for a new, pending, confirmed and unsubscribed address", async () => {
    const answers: string[] = [];
    for (const existing of [
      null,
      row(),
      row({ status: "confirmed", confirm_token_hash: null }),
      row({ status: "unsubscribed", confirm_token_hash: null }),
    ]) {
      rows = existing ? [existing] : [];
      const response = await post(VALID);
      answers.push(
        JSON.stringify({
          status: response.status,
          body: await response.json(),
          headers: [...response.headers.entries()].sort(),
        }),
      );
    }
    expect(new Set(answers).size).toBe(1);
    expect(JSON.parse(answers[0] ?? "")).toMatchObject({ status: 200, body: { ok: true } });
    // Everyone but the confirmed address got a confirm email, and nothing else.
    expect(mocks.queue).toHaveBeenCalledTimes(3);
    for (const [sent] of mocks.queue.mock.calls) expect(sent.event).toBe("newsletter_confirm");
  });

  it("runs Arcjet before reading the body, with its own rate limit", async () => {
    await post(VALID);
    expect(mocks.protect).toHaveBeenCalledWith(expect.any(Request), {
      route: "newsletter-subscribe",
      window: "10m",
      max: 5,
    });
    for (const [decision, status, code] of [
      ["rate_limited", 429, "rate_limited"],
      ["denied", 403, "forbidden"],
    ] as const) {
      mocks.protect.mockResolvedValue(decision);
      rows = [];
      const response = await post(VALID);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { code, message: en.errors[code] } });
      expect(rows).toEqual([]);
    }
  });

  it.each([
    ["no email", { locale: "en", source: "footer" }],
    ["a bad email", { ...VALID, email: "not-an-email" }],
    ["an unknown source", { ...VALID, source: "popup" }],
    ["an extra field", { ...VALID, status: "confirmed" }],
    ["a broken body", "{"],
  ])("refuses %s", async (_label, body) => {
    const response = await post(body, "https://site.example/ar");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_failed", message: ar.errors.validation_failed },
    });
    expect(rows).toEqual([]);
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("answers 500 when the database fails", async () => {
    db.fail = { code: "57014", message: "timeout" };
    const response = await post(VALID);
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});

describe("GET /api/newsletter/confirm", () => {
  const get = (query: string, language = "en-US,en;q=0.9") =>
    confirm.GET(
      new NextRequest(`https://site.example/api/newsletter/confirm${query}`, {
        headers: { "accept-language": language },
      }),
    );

  it("a good token confirms the row and redirects to the page in the row's language", async () => {
    rows = [row({ locale: "ar" })];
    const response = await get("?token=good-token");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://site.example/ar/newsletter/confirmed");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(rows[0]).toMatchObject({ status: "confirmed", confirm_token_hash: null });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a wrong token", "?token=bad"],
    ["no token", ""],
    ["an empty token", "?token="],
  ])("%s lands on status=invalid and changes nothing", async (_label, query) => {
    rows = [row()];
    const response = await get(query);
    expect(response.headers.get("location")).toBe(
      "https://site.example/en/newsletter/confirmed?status=invalid",
    );
    expect(rows[0]?.status).toBe("pending");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("a used token is invalid the second time", async () => {
    rows = [row()];
    await get("?token=good-token");
    const again = await get("?token=good-token", "ar");
    expect(again.headers.get("location")).toBe(
      "https://site.example/ar/newsletter/confirmed?status=invalid",
    );
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("the location never carries the token", async () => {
    rows = [row()];
    for (const query of ["?token=good-token", "?token=bad"]) {
      expect((await get(query)).headers.get("location")).not.toContain("token");
    }
  });

  it.each(["rate_limited", "denied"])("an Arcjet %s leaves the token unused", async (decision) => {
    rows = [row()];
    mocks.protect.mockResolvedValue(decision);
    const response = await get("?token=good-token");
    expect(response.headers.get("location")).toBe(
      "https://site.example/en/newsletter/confirmed?status=retry",
    );
    expect(rows[0]?.status).toBe("pending");
  });

  it("a database failure says to try again", async () => {
    rows = [row()];
    db.fail = { code: "57014", message: "timeout" };
    const response = await get("?token=good-token", "fr");
    expect(response.headers.get("location")).toBe(
      "https://site.example/ar/newsletter/confirmed?status=retry",
    );
  });
});
