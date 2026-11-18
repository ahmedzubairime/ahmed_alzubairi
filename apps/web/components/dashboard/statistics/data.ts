import "server-only";
import type { Database } from "@repo/db";
import type { Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { monthlyDownloads, monthlySignupShare, posthogQueryEnv } from "@/lib/analytics/posthog-query";
import { createUserClient } from "@/lib/supabase/user";
import { monthWindows, type MonthWindow } from "./months";
import { KPI_KEYS, KPI_PERMISSIONS, type KpiKey } from "./permissions";

export { KPI_KEYS, KPI_PERMISSIONS, STATISTICS_PERMISSIONS, type KpiKey } from "./permissions";

type Client = SupabaseClient<Database>;

/** The days the first-reply tile looks back. */
export const FIRST_REPLY_DAYS = 90;

/** At most this many rows for the first-reply average. */
export const FIRST_REPLY_ROW_CAP = 5000;

const DAY = 24 * 60 * 60 * 1000;

export type KpiData =
  | { key: "consultations" | "documentRequests" | "registrations" | "downloads"; months: number[] }
  /** Average hours to the first reply, per month (null: no reply that month) and over the last 90 days. */
  | { key: "firstReply"; months: (number | null)[]; recent: number | null; capped: boolean }
  /** Confirmed subscribers now, and how many of them signed up each month. */
  | { key: "newsletter"; total: number; months: number[] }
  | { key: "signupShare"; signups: number[]; visitors: number[] };

export type KpiResult = KpiData | { key: KpiKey; unavailable: true };

export type Statistics = { windows: MonthWindow[]; kpis: KpiResult[] };

export type StatisticsDeps = {
  /** The member's own client (RLS). Never the service client. */
  client?: Client;
  now?: Date;
  log?: (message: string) => void;
  posthog?: {
    enabled: () => boolean;
    downloads: typeof monthlyDownloads;
    signupShare: typeof monthlySignupShare;
  };
};

type HeadQuery = PromiseLike<{ count: number | null; error: { code: string } | null }>;

async function exact(label: string, query: HeadQuery): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(`${label} count failed: ${error.code}`);
  return count ?? 0;
}

/** One `head` count per month, in parallel. */
function perMonth(
  windows: readonly MonthWindow[],
  label: string,
  query: (window: MonthWindow) => HeadQuery,
): Promise<number[]> {
  return Promise.all(windows.map((window) => exact(label, query(window))));
}

const iso = (date: Date) => date.toISOString();

/** PostHog is off (no query key): expected until the keys exist, so not logged. */
class PosthogOff extends Error {}

function loaders(client: Client, windows: MonthWindow[], now: Date, posthog: NonNullable<StatisticsDeps["posthog"]>, timeZone: string) {
  const first = windows[0]!.start;
  const keys = windows.map((window) => window.key);
  return {
    consultations: async (): Promise<KpiData> => ({
      key: "consultations",
      months: await perMonth(windows, "consultations", (w) =>
        client
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .eq("kind", "consultation")
          .gte("created_at", iso(w.start))
          .lt("created_at", iso(w.end)),
      ),
    }),
    firstReply: async (): Promise<KpiData> => {
      const recentFrom = new Date(now.getTime() - FIRST_REPLY_DAYS * DAY);
      const from = recentFrom < first ? recentFrom : first;
      const { data, error } = await client
        .from("consultations")
        .select("created_at, first_reply_at")
        .eq("kind", "consultation")
        .not("first_reply_at", "is", null)
        .gte("created_at", iso(from))
        .order("created_at", { ascending: false })
        .limit(FIRST_REPLY_ROW_CAP);
      if (error) throw new Error(`first reply read failed: ${error.code}`);
      const rows = (data ?? []).flatMap((row) => {
        const created = new Date(row.created_at);
        const replied = row.first_reply_at ? new Date(row.first_reply_at) : null;
        return replied ? [{ created, hours: Math.max(0, replied.getTime() - created.getTime()) / 3_600_000 }] : [];
      });
      const average = (items: { hours: number }[]) =>
        items.length === 0 ? null : items.reduce((sum, item) => sum + item.hours, 0) / items.length;
      return {
        key: "firstReply",
        months: windows.map((w) => average(rows.filter((row) => row.created >= w.start && row.created < w.end))),
        recent: average(rows.filter((row) => row.created >= recentFrom)),
        capped: (data ?? []).length >= FIRST_REPLY_ROW_CAP,
      };
    },
    documentRequests: async (): Promise<KpiData> => ({
      key: "documentRequests",
      months: await perMonth(windows, "document requests", (w) =>
        client
          .from("document_requests")
          .select("id", { count: "exact", head: true })
          .gte("created_at", iso(w.start))
          .lt("created_at", iso(w.end)),
      ),
    }),
    registrations: async (): Promise<KpiData> => ({
      key: "registrations",
      months: await perMonth(windows, "registrations", (w) =>
        client
          .from("course_registrations")
          .select("id", { count: "exact", head: true })
          .gte("created_at", iso(w.start))
          .lt("created_at", iso(w.end)),
      ),
    }),
    newsletter: async (): Promise<KpiData> => {
      const [total, months] = await Promise.all([
        exact(
          "confirmed subscribers",
          client.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        ),
        perMonth(windows, "confirmed subscribers", (w) =>
          client
            .from("newsletter_subscribers")
            .select("id", { count: "exact", head: true })
            .eq("status", "confirmed")
            .gte("created_at", iso(w.start))
            .lt("created_at", iso(w.end)),
        ),
      ]);
      return { key: "newsletter", total, months };
    },
    downloads: async (): Promise<KpiData> => {
      if (!posthog.enabled()) throw new PosthogOff();
      return { key: "downloads", months: await posthog.downloads(timeZone, keys, iso(first)) };
    },
    signupShare: async (): Promise<KpiData> => {
      if (!posthog.enabled()) throw new PosthogOff();
      return { key: "signupShare", ...(await posthog.signupShare(timeZone, keys, iso(first))) };
    },
  } satisfies Record<KpiKey, () => Promise<KpiData>>;
}

const POSTHOG: NonNullable<StatisticsDeps["posthog"]> = {
  enabled: () => posthogQueryEnv() !== null,
  downloads: monthlyDownloads,
  signupShare: monthlySignupShare,
};

/**
 * The KPIs this member may see, for the last 12 months in their time zone.
 * A KPI runs only when the member holds its permission, so without it no
 * query is made. Each fails on its own: a failure (or PostHog off) shows
 * that tile as unavailable, never the page.
 */
export async function loadStatistics(
  granted: ReadonlySet<Permission>,
  timeZone: string,
  { client, now = new Date(), log = console.error, posthog = POSTHOG }: StatisticsDeps = {},
): Promise<Statistics> {
  const windows = monthWindows(now, timeZone);
  const shown = KPI_KEYS.filter((key) => granted.has(KPI_PERMISSIONS[key]));
  if (shown.length === 0) return { windows, kpis: [] };
  const run = loaders(client ?? createUserClient(), windows, now, posthog, timeZone);
  const kpis = await Promise.all(
    shown.map((key) =>
      run[key]().catch((error: unknown): KpiResult => {
        if (!(error instanceof PosthogOff)) log(`statistics: ${key} unavailable`);
        return { key, unavailable: true };
      }),
    ),
  );
  return { windows, kpis };
}
