import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const { byMonth, downloadsQuery, posthogQueryEnv, runHogQL, signupShareQuery } = await import("./posthog-query");

const ENV = { key: "phx_test", projectId: "12345" };
const START = new Date("2025-11-30T21:00:00Z");

describe("posthogQueryEnv", () => {
  it("needs both the key and a numeric project id", () => {
    expect(posthogQueryEnv({})).toBeNull();
    expect(posthogQueryEnv({ POSTHOG_PERSONAL_API_KEY: "phx_1" })).toBeNull();
    expect(posthogQueryEnv({ POSTHOG_PERSONAL_API_KEY: "phx_1", POSTHOG_PROJECT_ID: "abc" })).toBeNull();
    expect(posthogQueryEnv({ POSTHOG_PERSONAL_API_KEY: " phx_1 ", POSTHOG_PROJECT_ID: "42" })).toEqual({ key: "phx_1", projectId: "42" });
  });
});

describe("queries", () => {
  it("count downloads per month in the viewer's zone", () => {
    expect(downloadsQuery("Asia/Riyadh", START)).toBe(
      "SELECT formatDateTime(toTimeZone(timestamp, 'Asia/Riyadh'), '%Y-%m') AS month, count() AS downloads FROM events WHERE event = 'resource_downloaded' AND timestamp >= toDateTime('2025-11-30 21:00:00', 'UTC') GROUP BY month ORDER BY month",
    );
  });

  it("count sign-ups and unique visitors per month", () => {
    const query = signupShareQuery("UTC", START);
    // Per visitor first, so sign-ups are a subset of the visitors (never over 100%).
    expect(query).toContain("countIf(signed > 0 AND viewed > 0) AS signups, countIf(viewed > 0) AS visitors");
    expect(query).toContain("GROUP BY month, distinct_id");
  });

  it("refuse a zone or date that could change the query", () => {
    expect(() => downloadsQuery("UTC'); DROP TABLE events; --", START)).toThrow();
    expect(() => downloadsQuery("Mars/Base", START)).toThrow();
    expect(() => downloadsQuery("UTC", new Date("nope"))).toThrow();
  });
});

describe("runHogQL", () => {
  it("posts the query with the key and returns the rows", async () => {
    const fetcher = vi.fn(async () => Response.json({ results: [["2026-11", 3]] }));
    expect(await runHogQL("SELECT 1", { env: ENV, fetcher: fetcher as unknown as typeof fetch })).toEqual([["2026-11", 3]]);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://eu.posthog.com/api/projects/12345/query/");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer phx_test");
    expect(JSON.parse(String(init.body))).toMatchObject({ query: { kind: "HogQLQuery", query: "SELECT 1" } });
  });

  it("throws without a key, on an error status, a bad answer or a network error", async () => {
    await expect(runHogQL("SELECT 1", { env: null })).rejects.toThrow("no key");
    const cases = [
      async () => new Response("denied", { status: 403 }),
      async () => Response.json({ results: "x" }),
      async () => {
        throw new TypeError("fetch failed");
      },
    ];
    for (const fetcher of cases) {
      await expect(runHogQL("SELECT 1", { env: ENV, fetcher: fetcher as unknown as typeof fetch })).rejects.toThrow();
    }
  });
});

describe("byMonth", () => {
  it("lines rows up with the months, 0 where a month has none", () => {
    expect(byMonth([["2026-10", 4, 10], ["2026-11", "2", 8], ["2026-08", 0, 1]], ["2026-09", "2026-10", "2026-11"], 1)).toEqual([0, 4, 2]);
  });

  it.each([
    ["a null count", [["2026-11", null]]],
    ["a negative count", [["2026-11", -1]]],
    ["a fraction", [["2026-11", 1.5]]],
    ["text", [["2026-11", "many"]]],
    ["a bad month", [[null, 3]]],
  ])("throws on %s instead of showing a zero", (_label, rows) => {
    expect(() => byMonth(rows as unknown[][], ["2026-11"], 1)).toThrow();
  });
});
