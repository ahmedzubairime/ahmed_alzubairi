import { describe, expect, it } from "vitest";
import { EVENT_PROPERTIES, eventProperties, isAnalyticsEvent, slugOrNothing } from "./events";

describe("the event map", () => {
  it("holds exactly the seven events of §6.23", () => {
    expect(Object.keys(EVENT_PROPERTIES).sort()).toEqual(
      [
        "consultation_requested",
        "contact_sent",
        "course_registered",
        "document_requested",
        "newsletter_confirmed",
        "resource_downloaded",
        "signed_up",
      ].sort(),
    );
  });

  it("allows no personal property on any event", () => {
    const personal = /name|email|phone|message|subject|file|org_name|organization|user|clerk|consultation_id|request_id|title|text/;
    for (const properties of Object.values(EVENT_PROPERTIES)) {
      for (const key of properties) expect(key).not.toMatch(personal);
    }
  });
});

describe("eventProperties", () => {
  it("adds the locale and keeps allowed values", () => {
    expect(eventProperties("signed_up", {}, "ar")).toEqual({ locale: "ar" });
    expect(eventProperties("contact_sent", { org_type: "government" }, "en")).toEqual({ org_type: "government", locale: "en" });
    expect(eventProperties("document_requested", { count: 3 }, "en")).toEqual({ count: 3, locale: "en" });
    expect(eventProperties("consultation_requested", { service_slug: "حوكمة-المؤسسات" }, "ar")).toEqual({
      service_slug: "حوكمة-المؤسسات",
      locale: "ar",
    });
    expect(eventProperties("consultation_requested", { service_slug: undefined }, "ar")).toEqual({ locale: "ar" });
  });

  it.each([
    ["an unknown event", "user_logged_in", {}],
    ["an unknown property", "signed_up", { email: "a@b.test" }],
    ["a property of another event", "contact_sent", { org_type: "company", count: 1 }],
    ["free text as a slug", "consultation_requested", { service_slug: "Jane Doe <a@b.test>" }],
    ["an org type outside the enum", "contact_sent", { org_type: "Ministry of X" }],
    ["a count that isn't a small whole number", "document_requested", { count: 2.5 }],
    ["a missing required property", "resource_downloaded", {}],
    ["an access mode outside the enum", "resource_downloaded", { resource_access: "free" }],
    ["properties that aren't an object", "signed_up", "x"],
    ["an inherited key", "toString", {}],
  ])("refuses %s", (_label, name, properties) => {
    expect(eventProperties(name, properties, "en")).toBeNull();
  });

  it("refuses a page with no known language", () => {
    expect(eventProperties("signed_up", {}, "fr")).toBeNull();
    expect(eventProperties("signed_up", {}, "")).toBeNull();
  });

  it("knows its events", () => {
    expect(isAnalyticsEvent("contact_sent")).toBe(true);
    expect(isAnalyticsEvent("__proto__")).toBe(false);
  });
});

describe("slugOrNothing", () => {
  it("decodes a slug and refuses anything else", () => {
    expect(slugOrNothing("governance-basics")).toBe("governance-basics");
    expect(slugOrNothing(encodeURIComponent("أساسيات-الحوكمة"))).toBe("أساسيات-الحوكمة");
    expect(slugOrNothing("a b")).toBeUndefined();
    expect(slugOrNothing("%E0%A4%A")).toBeUndefined();
    expect(slugOrNothing(undefined)).toBeUndefined();
  });
});
