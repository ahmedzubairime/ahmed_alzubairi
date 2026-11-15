import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNewsletterDb, type SubscriberRow } from "@/lib/newsletter/fake-db";

let rows: SubscriberRow[];
const db: { fail?: { code: string; message: string } } = {};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeNewsletterDb(rows, db),
}));

const { POST } = await import("./route");

// A made-up signing secret in Svix's format: `whsec_` + base64 key.
const KEY = Buffer.from("test-signing-key-0123456789abcdef");
const SECRET = `whsec_${KEY.toString("base64")}`;
const EMAIL = "reader@example.com";

const row = (rest: Partial<SubscriberRow> = {}): SubscriberRow => ({
  email: EMAIL,
  status: "confirmed",
  confirm_token_hash: null,
  locale: "en",
  source: "footer",
  consented_at: "2026-11-01T00:00:00.000Z",
  ...rest,
});

const unsubscribed = (email = EMAIL, value: unknown = true) => ({
  type: "contact.updated",
  created_at: "2026-11-15T10:00:00.000Z",
  data: { id: "c1", email, unsubscribed: value },
});

/** A request signed the way Svix signs: HMAC-SHA256 over `id.timestamp.body`. */
function signed(
  event: unknown,
  { key = KEY, at = Date.now(), tamper = false, headers = true } = {},
) {
  const body = JSON.stringify(event);
  const id = "msg_test";
  const timestamp = String(Math.floor(at / 1000));
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new NextRequest("https://site.example/api/resend/webhook", {
    method: "POST",
    headers: headers
      ? { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` }
      : {},
    body: tamper ? body.replace(EMAIL, "other@example.com") : body,
  });
}

beforeEach(() => {
  rows = [row()];
  db.fail = undefined;
  vi.stubEnv("RESEND_WEBHOOK_SECRET", SECRET);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const spy of [console.error, console.warn]) {
    for (const call of vi.mocked(spy).mock.calls) {
      expect(call.join(" ")).not.toContain("example.com");
    }
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/resend/webhook", () => {
  it("a signed unsubscribe flips the row", async () => {
    const response = await POST(signed(unsubscribed("Reader@Example.com")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rows[0]?.status).toBe("unsubscribed");
  });

  it.each([
    ["another key", { key: Buffer.from("another-key-0123456789abcdefghij") }],
    ["a changed body", { tamper: true }],
    ["no signature headers", { headers: false }],
    ["an old timestamp", { at: Date.now() - 60 * 60 * 1000 }],
  ])("refuses %s with 401 and changes nothing", async (_label, options) => {
    const response = await POST(signed(unsubscribed(), options));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
    expect(rows[0]?.status).toBe("confirmed");
  });

  it.each([
    ["a resubscribe", unsubscribed(EMAIL, false)],
    ["another contact event", { ...unsubscribed(), type: "contact.created" }],
    ["an email event", { type: "email.delivered", data: { to: [EMAIL] } }],
    ["an unreadable contact event", { type: "contact.updated", data: {} }],
  ])("ignores %s with 200", async (_label, event) => {
    rows = [row(), row({ email: "p@example.com", status: "pending", confirm_token_hash: "h" })];
    const before = JSON.stringify(rows);
    const response = await POST(signed(event));
    expect(response.status).toBe(200);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("a late opt-out leaves a newer signup alone, pending or confirmed", async () => {
    // Consent is newer than the event (2026-11-15T10:00Z).
    rows = [row({ status: "pending", confirm_token_hash: "h", consented_at: "2026-11-15T11:00:00.000Z" })];
    expect((await POST(signed(unsubscribed()))).status).toBe(200);
    expect(rows[0]).toMatchObject({ status: "pending", confirm_token_hash: "h" });
    rows = [row({ consented_at: "2026-11-15T11:00:00.000Z" })];
    expect((await POST(signed(unsubscribed()))).status).toBe(200);
    expect(rows[0]?.status).toBe("confirmed");
  });

  it("an address with no row is a 200", async () => {
    const response = await POST(signed(unsubscribed("nobody@example.com")));
    expect(response.status).toBe(200);
    expect(rows[0]?.status).toBe("confirmed");
  });

  it("answers 500 so Resend retries when the database fails", async () => {
    db.fail = { code: "57014", message: "timeout" };
    expect((await POST(signed(unsubscribed()))).status).toBe(500);
  });

  it("without the secret it refuses everything, signed or not", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    expect((await POST(signed(unsubscribed()))).status).toBe(500);
    expect(rows[0]?.status).toBe("confirmed");
  });
});
