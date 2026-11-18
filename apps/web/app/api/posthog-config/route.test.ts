import { errorResponseSchema, posthogConfigResponseSchema } from "@repo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

const { GET } = await import("./route");

afterEach(() => vi.unstubAllEnvs());

const call = (referer?: string) =>
  GET(new Request("http://localhost/api/posthog-config", { headers: referer ? { referer } : {} }));

describe("GET /api/posthog-config", () => {
  it("returns the key and host, cached for 5 minutes", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(posthogConfigResponseSchema.parse(await response.json())).toEqual({
      key: "phc_test",
      host: "https://eu.i.posthog.com",
    });
  });

  it("answers 404 without the key, in the page's language, and isn't cached", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const response = await call("https://site.test/en/about");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = errorResponseSchema.parse(await response.json());
    expect(body.error).toEqual({ code: "not_found", message: "Analytics are turned off." });
    const ar = errorResponseSchema.parse(await (await call()).json());
    expect(ar.error.message).toBe("التحليلات متوقفة.");
  });
});
