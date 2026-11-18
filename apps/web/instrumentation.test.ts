import { afterEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("./lib/analytics/server", () => ({ captureServerError: capture }));

const { onRequestError } = await import("./instrumentation");

const REQUEST = { path: "/en/blog?q=1", method: "GET", headers: { cookie: "secret", authorization: "Bearer x" } };
const CONTEXT = { routerKind: "App Router", routePath: "/[locale]/blog", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined } as const;

afterEach(() => {
  vi.unstubAllEnvs();
  capture.mockClear();
});

describe("onRequestError", () => {
  it("sends the path and route to PostHog, never the headers", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const error = new Error("boom");
    await onRequestError(error, REQUEST, CONTEXT);
    expect(capture).toHaveBeenCalledWith(error, {
      path: "/en/blog?q=1",
      method: "GET",
      routerKind: "App Router",
      routePath: "/[locale]/blog",
      routeType: "render",
    });
    expect(JSON.stringify(capture.mock.calls)).not.toContain("secret");
  });

  it("skips the edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await onRequestError(new Error("x"), REQUEST, CONTEXT);
    expect(capture).not.toHaveBeenCalled();
  });
});
