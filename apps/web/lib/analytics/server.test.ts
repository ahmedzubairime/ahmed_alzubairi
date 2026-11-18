import { describe, expect, it, vi } from "vitest";
import { captureServerError, SERVER_DISTINCT_ID } from "./server";

const ENV = { key: "phc_1", host: "https://eu.i.posthog.com" };

function client() {
  return { captureExceptionImmediate: vi.fn(async () => {}), shutdown: vi.fn(async () => {}) };
}

describe("captureServerError", () => {
  it("sends the error under `server` with the path and no query, then flushes", async () => {
    const fake = client();
    const error = new Error("boom");
    await captureServerError(
      error,
      { path: "/api/contact?email=a@b.test", method: "POST", routerKind: "App Router", routePath: "/api/contact", routeType: "route" },
      { env: ENV, create: async () => fake },
    );
    expect(fake.captureExceptionImmediate).toHaveBeenCalledWith(error, {
      distinctId: SERVER_DISTINCT_ID,
      properties: {
        $current_url: "/api/contact",
        $pathname: "/api/contact",
        method: "POST",
        router_kind: "App Router",
        route_path: "/api/contact",
        route_type: "route",
      },
    });
    expect(fake.shutdown).toHaveBeenCalledOnce();
  });

  it("does nothing without the key", async () => {
    const create = vi.fn();
    await captureServerError(new Error("x"), { path: "/" }, { env: null, create });
    expect(create).not.toHaveBeenCalled();
  });

  it("never throws when PostHog fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = { captureExceptionImmediate: vi.fn(async () => {}), shutdown: vi.fn(async () => Promise.reject(new Error("down"))) };
    await expect(
      captureServerError(new Error("x"), { path: "/" }, { env: ENV, create: async () => failing }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith("analytics: server error capture failed", "Error");
    spy.mockRestore();
  });
});
