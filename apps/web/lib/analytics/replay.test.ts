import { describe, expect, it } from "vitest";
import { replayAllowed } from "./replay";

describe("replayAllowed", () => {
  it.each([
    "/ar",
    "/en",
    "/ar/",
    "/en/about",
    "/ar/services/حوكمة",
    "/en/blog/first-article",
    "/en/training",
    "/ar/contact",
    "/en/accountability",
  ])("records the public page %s", (path) => {
    expect(replayAllowed(path)).toBe(true);
  });

  it.each([
    "/ar/account",
    "/en/account/",
    "/ar/account/consultations/123",
    "/ar/dashboard",
    "/en/dashboard/consultations?status=new",
    "/AR/Dashboard",
    "/ar/sign-in",
    "/en/sign-in/factor-one",
    "/ar/sign-up",
    "/en/onboarding",
    "/%61r/dashboard",
    "/",
    "",
    "/fr/about",
    "/arabic",
    "/api/posthog-config",
    "/%E0%A4%A",
  ])("never records %s", (path) => {
    expect(replayAllowed(path)).toBe(false);
  });
});
