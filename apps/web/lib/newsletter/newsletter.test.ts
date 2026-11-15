import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeNewsletterDb, type SubscriberRow } from "./fake-db";

const mocks = vi.hoisted(() => ({
  queue: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  addSegment: vi.fn(),
  mailer: true,
}));

let rows: SubscriberRow[];
const db: { fail?: { code: string; message: string } } = {};

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => fakeNewsletterDb(rows, db),
}));
vi.mock("@/lib/email/queue", () => ({ queueEmail: mocks.queue }));
vi.mock("@/lib/email/resend", () => ({
  getMailer: () =>
    mocks.mailer
      ? {
          from: "x",
          resend: {
            contacts: {
              create: mocks.create,
              update: mocks.update,
              segments: { add: mocks.addSegment },
            },
          },
        }
      : null,
}));

const { addToAudience } = await import("./audience");
const { confirmSubscription } = await import("./confirm");
const { normalizeEmail, startSubscription } = await import("./subscribe");
const { hashConfirmToken, newConfirmToken } = await import("./token");
const { markUnsubscribed } = await import("./unsubscribe");

const EMAIL = "reader@example.com";
const row = (rest: Partial<SubscriberRow> = {}): SubscriberRow => ({
  email: EMAIL,
  status: "pending",
  confirm_token_hash: hashConfirmToken("old-token"),
  locale: "ar",
  source: "footer",
  consented_at: "2026-11-01T00:00:00.000Z",
  ...rest,
});

/** The token in the confirm link the last queued email carries. */
function queuedToken(): string {
  const call = mocks.queue.mock.calls.at(-1)?.[0] as { payload: { confirmUrl: string } };
  return new URL(call.payload.confirmUrl).searchParams.get("token") ?? "";
}

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rows = [];
  db.fail = undefined;
  mocks.mailer = true;
  mocks.queue.mockReset().mockResolvedValue(true);
  mocks.create.mockReset().mockResolvedValue({ data: { id: "c1" }, error: null });
  mocks.update.mockReset().mockResolvedValue({ data: { id: "c1" }, error: null });
  mocks.addSegment.mockReset().mockResolvedValue({ data: { id: "s1" }, error: null });
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/");
  vi.stubEnv("RESEND_AUDIENCE_ID", "seg_1");
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // No log line ever carries an address or a token.
  for (const call of errors.mock.calls) {
    expect(call.join(" ")).not.toContain("example.com");
    expect(call.join(" ")).not.toContain("token=");
  }
  errors.mockRestore();
  vi.unstubAllEnvs();
});

describe("the token", () => {
  it("is random, URL-safe, and stored only as a SHA-256 hash", () => {
    const a = newConfirmToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newConfirmToken()).not.toBe(a);
    expect(hashConfirmToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashConfirmToken(a)).not.toContain(a);
  });
});

describe("startSubscription", () => {
  const start = (email = EMAIL, locale: "ar" | "en" = "en") =>
    startSubscription({ email, locale, source: "blog" });

  it("a new address: a pending row with the hash only, and one confirm email", async () => {
    expect(await start("  Reader@Example.com ")).toBe("ok");
    expect(rows).toHaveLength(1);
    const [saved] = rows;
    expect(saved).toMatchObject({ email: EMAIL, status: "pending", locale: "en", source: "blog" });
    expect(saved?.consented_at).toBeTruthy();

    expect(mocks.queue).toHaveBeenCalledTimes(1);
    const sent = mocks.queue.mock.calls[0]?.[0];
    expect(sent).toMatchObject({ event: "newsletter_confirm", to: { email: EMAIL, locale: "en" } });
    expect(sent.payload.confirmUrl).toMatch(
      /^https:\/\/site\.example\/api\/newsletter\/confirm\?token=[A-Za-z0-9_-]{43}$/,
    );
    // The row holds the hash of the link's token, never the token.
    expect(saved?.confirm_token_hash).toBe(hashConfirmToken(queuedToken()));
    expect(JSON.stringify(rows)).not.toContain(queuedToken());
  });

  it.each(["pending", "unsubscribed"])("a %s row restarts with a new token", async (status) => {
    rows.push(row({ status }));
    expect(await start()).toBe("ok");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", locale: "en", source: "blog" });
    expect(rows[0]?.confirm_token_hash).toBe(hashConfirmToken(queuedToken()));
    // The old link no longer works.
    expect(await confirmSubscription("old-token")).toEqual({ status: "invalid" });
    expect(mocks.queue).toHaveBeenCalledTimes(1);
  });

  it("a confirmed row is left alone: no change, no email, the same answer", async () => {
    const confirmed = row({ status: "confirmed", confirm_token_hash: null });
    rows.push({ ...confirmed });
    expect(await start()).toBe("ok");
    expect(rows).toEqual([confirmed]);
    expect(mocks.queue).not.toHaveBeenCalled();
    // A sync that failed at confirm time is repaired here.
    expect(mocks.create).toHaveBeenCalledWith({
      email: EMAIL,
      unsubscribed: false,
      segments: [{ id: "seg_1" }],
    });
  });

  it("a confirmed row answers ok even when Resend is down", async () => {
    rows.push(row({ status: "confirmed", confirm_token_hash: null }));
    mocks.create.mockRejectedValue(new Error("down"));
    expect(await start()).toBe("ok");
  });

  it.each(["new", "pending", "unsubscribed"])("a %s address is never sent to Resend", async (state) => {
    if (state !== "new") rows.push(row({ status: state }));
    await start();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("answers ok even when the confirm email can't be queued", async () => {
    mocks.queue.mockResolvedValue(false);
    expect(await start()).toBe("ok");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(await start("other@example.com")).toBe("ok");
    expect(mocks.queue).toHaveBeenCalledTimes(1);
  });

  it("takes the link's host from NEXT_PUBLIC_APP_URL, path kept", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/app/?x=1#y");
    await start();
    const { payload } = mocks.queue.mock.calls[0]?.[0] as { payload: { confirmUrl: string } };
    expect(payload.confirmUrl.startsWith("https://site.example/app/api/newsletter/confirm?token=")).toBe(true);
  });

  it("fails only when the database does", async () => {
    db.fail = { code: "57014", message: "reader@example.com timed out" };
    expect(await start()).toBe("failed");
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("normalizes addresses", () => {
    expect(normalizeEmail(" A@B.Com ")).toBe("a@b.com");
  });
});

describe("confirmSubscription", () => {
  it("confirms a pending row once, clears the hash, and syncs the contact", async () => {
    rows.push(row({ locale: "en" }));
    expect(await confirmSubscription("old-token")).toEqual({ status: "confirmed", locale: "en" });
    expect(rows[0]).toMatchObject({ status: "confirmed", confirm_token_hash: null });
    expect(mocks.create).toHaveBeenCalledWith({
      email: EMAIL,
      unsubscribed: false,
      segments: [{ id: "seg_1" }],
    });
    // A second open of the same link.
    expect(await confirmSubscription("old-token")).toEqual({ status: "invalid" });
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it.each(["wrong-token", ""])("refuses the token %j", async (token) => {
    rows.push(row());
    expect(await confirmSubscription(token)).toEqual({ status: "invalid" });
    expect(rows[0]?.status).toBe("pending");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("never confirms an unsubscribed row, even with its old hash", async () => {
    rows.push(row({ status: "unsubscribed" }));
    expect(await confirmSubscription("old-token")).toEqual({ status: "invalid" });
    expect(rows[0]?.status).toBe("unsubscribed");
  });

  it("a Resend failure doesn't undo the confirm", async () => {
    rows.push(row());
    mocks.create.mockRejectedValue(new Error("network reader@example.com"));
    expect(await confirmSubscription("old-token")).toEqual({ status: "confirmed", locale: "ar" });
    expect(rows[0]?.status).toBe("confirmed");
  });

  it("a database failure leaves the token usable", async () => {
    rows.push(row());
    db.fail = { code: "57014", message: "timeout" };
    expect(await confirmSubscription("old-token")).toEqual({ status: "failed" });
    db.fail = undefined;
    expect((await confirmSubscription("old-token")).status).toBe("confirmed");
  });
});

describe("addToAudience", () => {
  it("an address Resend already holds is resubscribed and added to the segment", async () => {
    mocks.create.mockResolvedValue({ data: null, error: { name: "validation_error" } });
    expect(await addToAudience(EMAIL)).toBe("synced");
    expect(mocks.update).toHaveBeenCalledWith({ email: EMAIL, unsubscribed: false });
    expect(mocks.addSegment).toHaveBeenCalledWith({ email: EMAIL, segmentId: "seg_1" });
  });

  it("reports a failure without throwing", async () => {
    mocks.create.mockResolvedValue({ data: null, error: { name: "validation_error" } });
    mocks.update.mockResolvedValue({ data: null, error: { name: "not_found" } });
    expect(await addToAudience(EMAIL)).toBe("failed");
    expect(mocks.addSegment).not.toHaveBeenCalled();
  });

  it("does nothing without the keys", async () => {
    vi.stubEnv("RESEND_AUDIENCE_ID", "");
    expect(await addToAudience(EMAIL)).toBe("not_configured");
    vi.stubEnv("RESEND_AUDIENCE_ID", "seg_1");
    mocks.mailer = false;
    expect(await addToAudience(EMAIL)).toBe("not_configured");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe("markUnsubscribed", () => {
  it("flips a confirmed row, and only that address", async () => {
    rows.push(row({ status: "confirmed", confirm_token_hash: null }), row({ email: "b@example.com" }));
    expect(await markUnsubscribed("Reader@Example.com")).toBe(true);
    expect(rows[0]).toMatchObject({ status: "unsubscribed", confirm_token_hash: null });
    expect(rows[1]?.status).toBe("pending");
  });

  it("a late opt-out never kills a newer pending signup or its link", async () => {
    rows.push(row());
    expect(await markUnsubscribed(EMAIL, new Date("2026-10-01T00:00:00.000Z"))).toBe(true);
    expect(rows[0]).toMatchObject({ status: "pending", confirm_token_hash: hashConfirmToken("old-token") });
    expect((await confirmSubscription("old-token")).status).toBe("confirmed");
  });

  it("an opt-out older than the row's consent is ignored; a newer one applies", async () => {
    rows.push(row({ status: "confirmed", confirm_token_hash: null }));
    await markUnsubscribed(EMAIL, new Date("2026-10-31T23:59:59.000Z"));
    expect(rows[0]?.status).toBe("confirmed");
    await markUnsubscribed(EMAIL, new Date("2026-11-01T00:00:01.000Z"));
    expect(rows[0]?.status).toBe("unsubscribed");
  });

  it("an unknown address changes nothing; a database error answers false", async () => {
    rows.push(row());
    expect(await markUnsubscribed("nobody@example.com")).toBe(true);
    expect(rows[0]?.status).toBe("pending");
    db.fail = { code: "57014", message: "timeout" };
    expect(await markUnsubscribed(EMAIL)).toBe(false);
  });
});
