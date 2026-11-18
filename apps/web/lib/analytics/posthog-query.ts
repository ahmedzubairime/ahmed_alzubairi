import "server-only";
import { isIanaTimeZone } from "@repo/shared";
import { cacheLife } from "next/cache";

/**
 * PostHog's Query API (HogQL) for the statistics page (§6.23), server only.
 * It reads with a personal API key scoped to `query:read`; nothing here
 * reaches the browser. The project is in PostHog EU.
 */
export const POSTHOG_APP_HOST = "https://eu.posthog.com";

export type QueryEnv = { key: string; projectId: string };

/** The key and project, or null when either is unset: the tiles then show unavailable. */
export function posthogQueryEnv(env: Record<string, string | undefined> = process.env): QueryEnv | null {
  const key = env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = env.POSTHOG_PROJECT_ID?.trim();
  if (!key || !projectId || !/^\d+$/.test(projectId)) return null;
  return { key, projectId };
}

/** A zone name safe to put in a query: IANA names only, nothing else. */
function zone(timeZone: string): string {
  if (!isIanaTimeZone(timeZone) || !/^[A-Za-z0-9_+/-]+$/.test(timeZone)) throw new Error("bad time zone");
  return timeZone;
}

/** `YYYY-MM-DD HH:MM:SS` in UTC, the form HogQL's toDateTime reads. */
function utc(instant: Date): string {
  if (Number.isNaN(instant.getTime())) throw new Error("bad date");
  return instant.toISOString().slice(0, 19).replace("T", " ");
}

const month = (timeZone: string) => `formatDateTime(toTimeZone(timestamp, '${zone(timeZone)}'), '%Y-%m')`;

/** `resource_downloaded` events per month in the viewer's zone, from `start` on. */
export function downloadsQuery(timeZone: string, start: Date): string {
  return `SELECT ${month(timeZone)} AS month, count() AS downloads FROM events WHERE event = 'resource_downloaded' AND timestamp >= toDateTime('${utc(start)}', 'UTC') GROUP BY month ORDER BY month`;
}

/**
 * Per month: unique visitors (distinct ids with a pageview), and how many
 * of them signed up that month. Without cookie consent a visitor's id lives for one visit, so
 * visitors are approximate (the page says so).
 */
export function signupShareQuery(timeZone: string, start: Date): string {
  // Per month and visitor first, so sign-ups count only visitors who also
  // viewed a page that month: the share can't pass 100%.
  return `SELECT month, countIf(signed > 0 AND viewed > 0) AS signups, countIf(viewed > 0) AS visitors FROM (SELECT ${month(timeZone)} AS month, distinct_id, countIf(event = 'signed_up') AS signed, countIf(event = '$pageview') AS viewed FROM events WHERE event IN ('$pageview', 'signed_up') AND timestamp >= toDateTime('${utc(start)}', 'UTC') GROUP BY month, distinct_id) GROUP BY month ORDER BY month`;
}

export type QueryDeps = { env?: QueryEnv | null; fetcher?: typeof fetch };

/** Runs one HogQL query and returns its rows. Throws on any failure. */
export async function runHogQL(query: string, { env = posthogQueryEnv(), fetcher = fetch }: QueryDeps = {}): Promise<unknown[][]> {
  if (!env) throw new Error("posthog query: no key");
  const response = await fetcher(`${POSTHOG_APP_HOST}/api/projects/${env.projectId}/query/`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.key}`, "content-type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query }, name: "dashboard statistics" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`posthog query failed: ${response.status}`);
  const body = (await response.json()) as { results?: unknown };
  if (!Array.isArray(body.results) || !body.results.every(Array.isArray)) throw new Error("posthog query: bad answer");
  return body.results as unknown[][];
}

/** A count cell: a whole number, or a numeric string of one. Anything else is invalid. */
function count(cell: unknown): number {
  const value = typeof cell === "number" ? cell : typeof cell === "string" && /^\d+$/.test(cell) ? Number(cell) : NaN;
  if (!Number.isInteger(value) || value < 0) throw new Error("posthog query: bad count");
  return value;
}

/**
 * Rows keyed by their `YYYY-MM` first column, as numbers per month key. A
 * month with no row is 0; a row with a bad month or count throws, so the
 * tile shows unavailable instead of a wrong zero.
 */
export function byMonth(rows: unknown[][], keys: readonly string[], column: number): number[] {
  const found = new Map<string, number>();
  for (const row of rows) {
    if (typeof row[0] !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row[0])) throw new Error("posthog query: bad month");
    found.set(row[0], count(row[column]));
  }
  return keys.map((key) => found.get(key) ?? 0);
}

/**
 * Resource downloads per month (oldest first, one per key). Cached for an
 * hour per zone and window; a failure throws and isn't cached.
 */
export async function monthlyDownloads(timeZone: string, keys: string[], startIso: string): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  return byMonth(await runHogQL(downloadsQuery(timeZone, new Date(startIso))), keys, 1);
}

/** Sign-ups and unique visitors per month. Cached like `monthlyDownloads`. */
export async function monthlySignupShare(
  timeZone: string,
  keys: string[],
  startIso: string,
): Promise<{ signups: number[]; visitors: number[] }> {
  "use cache";
  cacheLife("hours");
  const rows = await runHogQL(signupShareQuery(timeZone, new Date(startIso)));
  return { signups: byMonth(rows, keys, 1), visitors: byMonth(rows, keys, 2) };
}
