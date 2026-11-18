import { describe, expect, it } from "vitest";
import { sanitizeEvent, stripUrl } from "./sanitize";

describe("stripUrl", () => {
  it.each([
    ["https://site.test/en/contact?email=a@b.test#form", "https://site.test/en/contact"],
    ["https://site.test/ar/blog#top", "https://site.test/ar/blog"],
    ["/en/dashboard?search=Ahmed", "/en/dashboard"],
    ["https://site.test/en", "https://site.test/en"],
    ["$direct", "$direct"],
  ])("%s → %s", (input, output) => {
    expect(stripUrl(input)).toBe(output);
  });

  it("leaves a value that isn't text", () => {
    expect(stripUrl(null)).toBeNull();
    expect(stripUrl(3)).toBe(3);
  });
});

describe("sanitizeEvent", () => {
  it("strips the query and hash from every URL property, $set and $set_once too", () => {
    const out = sanitizeEvent({
      event: "$pageview",
      properties: {
        $current_url: "https://site.test/en/resources?q=name#x",
        $pathname: "/en/resources?q=name",
        $referrer: "https://search.test/?q=Ahmed+Alzubairi",
        $prev_pageview_pathname: "/en?ref=mail",
        $browser: "Chrome",
        token: "phc_test",
        distinct_id: "anon",
      },
      $set: { $current_url: "https://site.test/en?x=1" },
      $set_once: { $initial_referrer: "https://ref.test/?a=b" },
    });
    expect(out?.properties).toEqual({
      $current_url: "https://site.test/en/resources",
      $pathname: "/en/resources",
      $referrer: "https://search.test/",
      $prev_pageview_pathname: "/en",
      $browser: "Chrome",
      token: "phc_test",
      distinct_id: "anon",
    });
    expect(out?.$set).toEqual({ $current_url: "https://site.test/en" });
    expect(out?.$set_once).toEqual({ $initial_referrer: "https://ref.test/" });
  });

  it("removes the page title, which can name a client on a dashboard page", () => {
    const out = sanitizeEvent({ event: "$pageview", properties: { title: "Consultation — Jane Doe", $browser: "x" } });
    expect(out?.properties).toEqual({ $browser: "x" });
  });

  it("drops an event that carries a property outside the allow-list", () => {
    expect(sanitizeEvent({ event: "$pageview", properties: { message: "Hello" } })).toBeNull();
    expect(sanitizeEvent({ event: "$exception", properties: { email: "a@b.test" } })).toBeNull();
  });

  it("drops our own events until T06 lists them", () => {
    expect(sanitizeEvent({ event: "contact_sent", properties: {} })).toBeNull();
  });

  it("drops PostHog events we didn't keep (autocapture, clicks, identify)", () => {
    for (const event of ["$autocapture", "$rageclick", "$dead_click", "$identify", "$set", "$groupidentify"]) {
      expect(sanitizeEvent({ event, properties: {} })).toBeNull();
    }
  });

  it("keeps exceptions, with the same URL stripping", () => {
    const out = sanitizeEvent({
      event: "$exception",
      properties: { $exception_list: [], $current_url: "https://site.test/ar?token=1" },
    });
    expect(out?.properties?.$current_url).toBe("https://site.test/ar");
  });

  it("strips the page address from a replay's Meta record", () => {
    const out = sanitizeEvent({
      event: "$snapshot",
      properties: {
        $snapshot_data: [
          { type: 4, data: { href: "https://site.test/en/contact?email=a@b.test", width: 1 } },
          { type: 3, data: { source: 1 } },
        ],
      },
    });
    expect(out?.properties?.$snapshot_data).toEqual([
      { type: 4, data: { href: "https://site.test/en/contact", width: 1 } },
      { type: 3, data: { source: 1 } },
    ]);
  });

  it("drops what it can't read, never throws", () => {
    expect(sanitizeEvent(null)).toBeNull();
    expect(sanitizeEvent({ event: 3 as unknown as string })).toBeNull();
    const hostile = { event: "$pageview", get properties(): Record<string, unknown> { throw new Error("boom"); } };
    expect(sanitizeEvent(hostile)).toBeNull();
  });
});
