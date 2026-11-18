import { describe, expect, it } from "vitest";
import { DEFAULT_POSTHOG_HOST, posthogEnv, uiHost } from "./env";

describe("posthogEnv", () => {
  it("is null without a key", () => {
    expect(posthogEnv({})).toBeNull();
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "  ", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com" })).toBeNull();
  });

  it("reads the key and the EU host's origin", () => {
    expect(
      posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com/" }),
    ).toEqual({ key: "phc_1", host: "https://eu.i.posthog.com" });
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1" })).toEqual({ key: "phc_1", host: DEFAULT_POSTHOG_HOST });
  });

  it.each([
    "https://us.i.posthog.com",
    "http://eu.i.posthog.com",
    "http://localhost:8010",
    "https://eu.i.posthog.com.evil.test",
    "not a url",
    "javascript:alert(1)",
  ])("turns PostHog off for any host but EU's ingestion host: %s", (host) => {
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: host })).toBeNull();
  });
});

describe("uiHost", () => {
  it("maps the ingestion host to the app host", () => {
    expect(uiHost("https://eu.i.posthog.com")).toBe("https://eu.posthog.com");
    expect(uiHost("https://us.i.posthog.com")).toBe("https://us.posthog.com");
  });
});
