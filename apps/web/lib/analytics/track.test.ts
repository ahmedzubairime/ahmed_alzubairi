// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_QUEUED, resetTracker, track, trackerOff, trackerStarted } from "./track";

const posthog = { capture: vi.fn() };

beforeEach(() => {
  resetTracker();
  posthog.capture.mockClear();
  document.documentElement.lang = "ar";
});

afterEach(() => vi.restoreAllMocks());

describe("track", () => {
  it("sends an allowed event with the page's language once PostHog runs", () => {
    trackerStarted(posthog);
    track("contact_sent", { org_type: "company" });
    expect(posthog.capture).toHaveBeenCalledExactlyOnceWith("contact_sent", { org_type: "company", locale: "ar" });
  });

  it("keeps events until PostHog starts, then sends them in order", () => {
    track("signed_up");
    track("document_requested", { count: 2 });
    expect(posthog.capture).not.toHaveBeenCalled();
    trackerStarted(posthog);
    expect(posthog.capture.mock.calls).toEqual([
      ["signed_up", { locale: "ar" }],
      ["document_requested", { count: 2, locale: "ar" }],
    ]);
  });

  it("keeps at most MAX_QUEUED events while waiting", () => {
    for (let index = 0; index < MAX_QUEUED + 5; index++) track("signed_up");
    trackerStarted(posthog);
    expect(posthog.capture).toHaveBeenCalledTimes(MAX_QUEUED);
  });

  it("is a no-op when PostHog stays off, and drops what was waiting", () => {
    track("signed_up");
    trackerOff();
    track("signed_up");
    trackerStarted(posthog);
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("refuses an unknown event or property at run time", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    trackerStarted(posthog);
    (track as (event: string, properties?: unknown) => void)("user_logged_in");
    (track as (event: string, properties?: unknown) => void)("signed_up", { email: "a@b.test" });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("never throws, even when PostHog does", () => {
    trackerStarted({ capture: () => { throw new Error("boom"); } });
    expect(() => track("signed_up")).not.toThrow();
  });

  it("refuses unknown events and properties at compile time", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // These compile: the next four must not.
    track("signed_up");
    track("contact_sent", { org_type: "company" });
    // @ts-expect-error: not one of the seven events
    track("user_logged_in");
    // @ts-expect-error: a property no event allows
    track("signed_up", { email: "a@b.test" });
    // @ts-expect-error: a required property is missing
    track("document_requested");
    // @ts-expect-error: org_type is an enum, not free text
    track("contact_sent", { org_type: "Ministry of X" });
  });
});
