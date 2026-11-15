import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ protect: vi.fn(), options: [] as unknown[] }));

vi.mock("server-only", () => ({}));
// The real lib/arcjet runs; only the SDK is replaced.
vi.mock("@arcjet/next", () => ({
  default: (options: unknown) => {
    mocks.options.push(options);
    return { protect: mocks.protect, withRule: () => ({ protect: mocks.protect }) };
  },
  shield: (options: object) => ({ rule: "shield", ...options }),
  detectBot: (options: object) => ({ rule: "detectBot", ...options }),
  fixedWindow: (options: object) => ({ rule: "fixedWindow", ...options }),
  validateEmail: (options: object) => ({ rule: "validateEmail", ...options }),
}));

const { resetArcjetClients, validateFormEmail } = await import("./index");

const EMAIL = "visitor@example.com";
const request = () => new Request("https://site.example/api/x", { method: "POST" });
const decision = (fields: { denied?: boolean; email?: boolean; errored?: boolean }) => ({
  isErrored: () => fields.errored ?? false,
  isDenied: () => fields.denied ?? false,
  reason: { isEmail: () => fields.email ?? false, message: "timeout" },
});

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("ARCJET_KEY", "ajkey_test");
  resetArcjetClients();
  mocks.options.length = 0;
  mocks.protect.mockReset().mockResolvedValue(decision({}));
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validateFormEmail", () => {
  it("accepts an address Arcjet allows, and sends it the email", async () => {
    const sent = request();
    expect(await validateFormEmail(sent, EMAIL, "test-route")).toBe(true);
    expect(mocks.protect).toHaveBeenCalledWith(sent, { email: EMAIL });
    expect(mocks.options[0]).toMatchObject({
      rules: [{ rule: "validateEmail", mode: "LIVE", deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"] }],
    });
  });

  it("refuses an address Arcjet denies for its email", async () => {
    mocks.protect.mockResolvedValue(decision({ denied: true, email: true }));
    expect(await validateFormEmail(request(), EMAIL, "test-route")).toBe(false);
  });

  it("builds the client once", async () => {
    await validateFormEmail(request(), EMAIL, "test-route");
    await validateFormEmail(request(), EMAIL, "other-route");
    expect(mocks.options).toHaveLength(1);
  });

  it("fails open on an errored decision, a throw, or a missing key, without logging the address", async () => {
    mocks.protect.mockResolvedValue(decision({ errored: true, denied: true, email: true }));
    expect(await validateFormEmail(request(), EMAIL, "test-route")).toBe(true);

    mocks.protect.mockRejectedValue(new Error("network"));
    expect(await validateFormEmail(request(), EMAIL, "test-route")).toBe(true);

    vi.stubEnv("ARCJET_KEY", "");
    resetArcjetClients();
    expect(await validateFormEmail(request(), EMAIL, "test-route")).toBe(true);

    expect(logged).toHaveBeenCalledTimes(3);
    for (const call of logged.mock.calls) {
      expect(String(call[0])).toContain("[arcjet] test-route");
      expect(JSON.stringify(call)).not.toContain(EMAIL);
    }
  });
});
