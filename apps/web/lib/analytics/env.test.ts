import { describe, expect, it } from "vitest";
import { DEFAULT_POSTHOG_HOST, posthogEnv, uiHost } from "./env";

describe("posthogEnv", () => {
  it("is null without a key", () => {
    expect(posthogEnv({})).toBeNull();
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "  ", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com" })).toBeNull();
  });

  it("reads the key and host's origin", () => {
    expect(
      posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com/" }),
    ).toEqual({ key: "phc_1", host: "https://eu.i.posthog.com" });
  });

  it("uses the EU host when HOST is unset, and refuses a bad one", () => {
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1" })).toEqual({ key: "phc_1", host: DEFAULT_POSTHOG_HOST });
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "not a url" })).toBeNull();
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "javascript:alert(1)" })).toBeNull();
  });

  it("refuses plain HTTP except a local PostHog", () => {
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "http://eu.i.posthog.com" })).toBeNull();
    expect(posthogEnv({ NEXT_PUBLIC_POSTHOG_KEY: "phc_1", NEXT_PUBLIC_POSTHOG_HOST: "http://localhost:8010" })).toEqual({
      key: "phc_1",
      host: "http://localhost:8010",
    });
  });
});

describe("uiHost", () => {
  it("maps the ingestion host to the app host", () => {
    expect(uiHost("https://eu.i.posthog.com")).toBe("https://eu.posthog.com");
    expect(uiHost("https://us.i.posthog.com")).toBe("https://us.posthog.com");
  });
});
