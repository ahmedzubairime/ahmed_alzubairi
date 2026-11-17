import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormDecision } from "@/lib/arcjet";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/arcjet", () => ({ protectForm: vi.fn(), validateFormEmail: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/newsletter/subscribe", () => ({ startSubscription: vi.fn() }));

const { handleResourceDownloadRequest, subscribeFromDownload } = await import("./route");
const { createResourceStore } = await import("./store");
import type { DownloadableResource } from "./handlers";
import type { ResourceRouteDeps } from "./route";

const ID = "7b0f6c1e-2a54-4a8e-9d57-3c1f0e6a9b21";
const KEY = "resources/secret-key.pdf";
const URL_OUT = "https://storage.example/object/sign/resources/file.pdf?token=abc";
const EMAIL = "visitor@example.com";

/** A body sent as written, not as JSON. */
class Raw {
  constructor(readonly text: string) {}
}

const state = {
  decision: "allow" as FormDecision,
  resource: null as DownloadableResource | null,
  emailOk: true,
};
const findPublished = vi.fn(async () => state.resource);
const signDownload = vi.fn(async () => URL_OUT);
const isAcceptableEmail = vi.fn(async () => state.emailOk);
const createStore = vi.fn(() => ({ findPublished, signDownload }));
const subscribe = vi.fn(async () => "ok");

const deps: ResourceRouteDeps = {
  protect: async () => state.decision,
  createStore,
  isAcceptableEmail,
  subscribe,
};

function call(body?: unknown, id = ID, referer = "https://site.example/en/resources") {
  const request = new Request(`https://site.example/api/resources/${id}/download`, {
    method: "POST",
    headers: { referer, "content-type": "application/json" },
    body: body === undefined ? undefined : body instanceof Raw ? body.text : JSON.stringify(body),
  });
  return handleResourceDownloadRequest(request, id, deps);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.decision = "allow";
  state.resource = { storageKey: KEY, access: "direct" };
  state.emailOk = true;
});

describe("POST /api/resources/:id/download", () => {
  it("direct: returns the signed URL, uncached, with no body needed", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ url: URL_OUT });
    expect(signDownload).toHaveBeenCalledWith(KEY);
    expect(isAcceptableEmail).not.toHaveBeenCalled();
  });

  it("email: refuses without an email, with a 400 in the visitor's language", async () => {
    state.resource = { storageKey: KEY, access: "email" };
    const response = await call({});
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "validation_failed", message: "Enter your email address to download this resource." },
    });
    expect(signDownload).not.toHaveBeenCalled();

    const arabic = await call({}, ID, "https://site.example/ar/resources");
    expect((await arabic.json()).error.message).toBe("أدخل بريدك الإلكتروني لتحميل هذا المورد.");
  });

  it("email: returns the signed URL with an acceptable email, and accepts consent", async () => {
    state.resource = { storageKey: KEY, access: "email" };
    const response = await call({ email: EMAIL, consent: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: URL_OUT });
    expect(isAcceptableEmail).toHaveBeenCalledWith(expect.any(Request), EMAIL);
  });

  it("starts the newsletter opt-in only with explicit consent, in the page's language", async () => {
    state.resource = { storageKey: KEY, access: "email" };
    await call({ email: EMAIL, consent: true }, ID, "https://site.example/ar/resources");
    expect(subscribe).toHaveBeenCalledExactlyOnceWith(EMAIL, "ar");

    subscribe.mockClear();
    for (const body of [{ email: EMAIL }, { email: EMAIL, consent: false }]) {
      expect((await call(body)).status).toBe(200);
    }
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("never subscribes an email it refuses, or for a resource that isn't there", async () => {
    state.resource = { storageKey: KEY, access: "email" };
    state.emailOk = false;
    expect((await call({ email: EMAIL, consent: true })).status).toBe(400);
    state.emailOk = true;
    state.resource = null;
    expect((await call({ email: EMAIL, consent: true })).status).toBe(404);
    state.decision = "rate_limited";
    expect((await call({ email: EMAIL, consent: true })).status).toBe(429);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("still gives the file when the signup fails, and logs no email", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    state.resource = { storageKey: KEY, access: "email" };
    subscribe.mockRejectedValueOnce(new Error(`insert failed for ${EMAIL}`));
    const response = await call({ email: EMAIL, consent: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: URL_OUT });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(EMAIL);
    logged.mockRestore();
  });

  it("signs up through the newsletter lib with source resource", async () => {
    const { startSubscription } = await import("@/lib/newsletter/subscribe");
    vi.mocked(startSubscription).mockResolvedValueOnce("ok");
    await subscribeFromDownload(EMAIL, "en");
    expect(startSubscription).toHaveBeenCalledExactlyOnceWith({ email: EMAIL, locale: "en", source: "resource" });
  });

  it("refuses an email Arcjet rejects, on either kind of resource", async () => {
    state.emailOk = false;
    for (const access of ["email", "direct"] as const) {
      state.resource = { storageKey: KEY, access };
      const response = await call({ email: EMAIL });
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("validation_failed");
    }
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("refuses a malformed body: bad email, consent without email, unknown field", async () => {
    for (const body of [{ email: "not-an-email" }, { consent: true }, { email: EMAIL, extra: 1 }]) {
      const response = await call(body);
      expect(response.status).toBe(400);
    }
    expect(findPublished).not.toHaveBeenCalled();
  });

  it("refuses JSON null and text that isn't JSON, but takes an empty body", async () => {
    for (const body of [null, new Raw('{"email":'), new Raw("email=x"), [], "text"]) {
      const response = await call(body);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("validation_failed");
    }
    expect(signDownload).not.toHaveBeenCalled();
    expect((await call(new Raw("  "))).status).toBe(200);
  });

  it("returns 404 for a draft or missing resource, and for a bad id", async () => {
    state.resource = null;
    const response = await call({ email: EMAIL });
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
    expect(isAcceptableEmail).not.toHaveBeenCalled();

    expect((await call(undefined, "not-a-uuid")).status).toBe(404);
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited and 403 for a bot, before any read", async () => {
    state.decision = "rate_limited";
    const limited = await call();
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("rate_limited");

    state.decision = "denied";
    expect((await call()).status).toBe(403);
    expect(createStore).not.toHaveBeenCalled();
  });

  it("returns 500 on a store failure, without the key or the email in the log", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    signDownload.mockRejectedValueOnce(new Error("resources createSignedUrl failed: boom"));
    const response = await call({ email: EMAIL });
    expect(response.status).toBe(500);
    const text = JSON.stringify([await response.json(), logged.mock.calls]);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(EMAIL);
  });
});

describe("createResourceStore", () => {
  function client(row: unknown, signed = { data: { signedUrl: URL_OUT }, error: null as null | { message: string } }) {
    const filters: [string, unknown][] = [];
    const createSignedUrl = vi.fn(async () => signed);
    const bucket = vi.fn(() => ({ createSignedUrl }));
    const builder = {
      select: vi.fn(() => builder),
      eq: (column: string, value: unknown) => (filters.push([column, value]), builder),
      maybeSingle: async () => ({ data: row, error: null }),
    };
    const service = { from: vi.fn(() => builder), storage: { from: bucket } };
    return { service: service as never, filters, builder, bucket, createSignedUrl };
  }

  it("reads only a published row", async () => {
    const fake = client({ storage_key: KEY, access: "email", status: "published" });
    expect(await createResourceStore(fake.service).findPublished(ID)).toEqual({ storageKey: KEY, access: "email" });
    expect(fake.filters).toEqual([["id", ID], ["status", "published"]]);
    expect(fake.builder.select).toHaveBeenCalledWith("storage_key, access, status");
  });

  it("treats a draft as absent, even if the query returned it", async () => {
    const fake = client({ storage_key: KEY, access: "direct", status: "draft" });
    expect(await createResourceStore(fake.service).findPublished(ID)).toBeNull();
    expect(await createResourceStore(client(null).service).findPublished(ID)).toBeNull();
  });

  it("signs from the private resources bucket for 60 seconds", async () => {
    const fake = client(null);
    expect(await createResourceStore(fake.service).signDownload(KEY)).toBe(URL_OUT);
    expect(fake.bucket).toHaveBeenCalledWith("resources");
    expect(fake.createSignedUrl).toHaveBeenCalledWith(KEY, 60, { download: true });
  });

  it("throws when signing fails", async () => {
    const fake = client(null, { data: null as never, error: { message: "boom" } });
    await expect(createResourceStore(fake.service).signDownload(KEY)).rejects.toThrow("createSignedUrl failed");
  });
});
