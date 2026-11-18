import { describe, expect, it } from "vitest";
import { bucket, monthKey, monthLabel, monthStart, monthWindows, viewerTimeZone } from "./months";

describe("monthWindows", () => {
  it("gives 12 months, oldest first, ending with the current one", () => {
    const windows = monthWindows(new Date("2026-11-18T12:00:00Z"), "UTC");
    expect(windows).toHaveLength(12);
    expect(windows[0]!.key).toBe("2025-12");
    expect(windows[11]!).toEqual({
      key: "2026-11",
      start: new Date("2026-11-01T00:00:00Z"),
      end: new Date("2026-12-01T00:00:00Z"),
    });
    for (let index = 1; index < windows.length; index++) expect(windows[index]!.start).toEqual(windows[index - 1]!.end);
  });

  it("starts a month at local midnight in the viewer's zone", () => {
    const windows = monthWindows(new Date("2026-11-18T12:00:00Z"), "Asia/Riyadh");
    // Riyadh is UTC+3: 1 Nov 00:00 local is 31 Oct 21:00 UTC.
    expect(windows[11]!.start).toEqual(new Date("2026-10-31T21:00:00Z"));
    expect(windows[11]!.end).toEqual(new Date("2026-11-30T21:00:00Z"));
  });

  it("takes the current month in the viewer's zone, not UTC's", () => {
    // 30 Nov 23:30 UTC is already 1 Dec in Riyadh.
    const now = new Date("2026-11-30T23:30:00Z");
    expect(monthWindows(now, "UTC").at(-1)!.key).toBe("2026-11");
    expect(monthWindows(now, "Asia/Riyadh").at(-1)!.key).toBe("2026-12");
  });

  it("handles a DST change inside a month", () => {
    // New York: 1 Mar is EST (UTC−5), 1 Apr is EDT (UTC−4).
    expect(monthStart(2026, 3, "America/New_York")).toEqual(new Date("2026-03-01T05:00:00Z"));
    expect(monthStart(2026, 4, "America/New_York")).toEqual(new Date("2026-04-01T04:00:00Z"));
  });
});

describe("bucket", () => {
  it("puts an instant in the viewer's month across a time-zone boundary", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    // 31 Oct 22:00 UTC is 1 Nov 01:00 in Riyadh.
    const instants = [new Date("2026-10-31T22:00:00Z"), new Date("2026-10-15T10:00:00Z"), new Date("2020-01-01T00:00:00Z")];
    expect(bucket(instants, monthWindows(now, "UTC")).slice(-2)).toEqual([2, 0]);
    expect(bucket(instants, monthWindows(now, "Asia/Riyadh")).slice(-2)).toEqual([1, 1]);
    expect(bucket(instants, monthWindows(now, "UTC")).reduce((a, b) => a + b)).toBe(2);
  });

  it("agrees with monthKey", () => {
    expect(monthKey(new Date("2026-10-31T22:00:00Z"), "Asia/Riyadh")).toBe("2026-11");
    expect(monthKey(new Date("2026-10-31T22:00:00Z"), "UTC")).toBe("2026-10");
  });
});

describe("viewerTimeZone", () => {
  it("falls back to UTC when unset or unknown", () => {
    expect(viewerTimeZone("Asia/Riyadh")).toBe("Asia/Riyadh");
    expect(viewerTimeZone(null)).toBe("UTC");
    expect(viewerTimeZone("Mars/Base")).toBe("UTC");
    expect(viewerTimeZone("'; DROP")).toBe("UTC");
  });

  it("returns the canonical spelling PostHog's HogQL needs", () => {
    expect(viewerTimeZone("asia/riyadh")).toBe("Asia/Riyadh");
    expect(viewerTimeZone("AMERICA/NEW_YORK")).toBe("America/New_York");
  });
});

describe("monthLabel", () => {
  it("names the month in the viewer's language", () => {
    expect(monthLabel("2026-11", "en")).toBe("Nov");
    expect(monthLabel("2026-11", "en", true)).toBe("Nov 2026");
    expect(monthLabel("2026-11", "ar")).toMatch(/نوفمبر/);
  });
});
