import { posthogConfigResponseSchema } from "@repo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {},
}));

const { GET } = await import("./route");

afterEach(() => vi.unstubAllEnvs());


describe("GET /api/posthog-config", () => {
  it("returns the key and host, cached for 5 minutes", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(posthogConfigResponseSchema.parse(await response.json())).toEqual({
      key: "phc_test",
      host: "https://eu.i.posthog.com",
    });
  });

  it("answers 204 with no body without the key, and isn't cached", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const response = await GET();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });
});
