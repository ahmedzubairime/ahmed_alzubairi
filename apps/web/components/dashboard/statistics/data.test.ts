import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({
  createUserClient: vi.fn(() => {
    throw new Error("tests pass their own client");
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => {
    throw new Error("statistics never use the service client");
  }),
}));

const { KPI_KEYS, KPI_PERMISSIONS, STATISTICS_PERMISSIONS, loadStatistics } = await import("./data");
const { createUserClient } = await import("@/lib/supabase/user");

type Filter = [string, ...unknown[]];
type Query = { table: string; select: unknown[]; filters: Filter[] };
type Answer = { data?: unknown; count?: number | null; error: { code: string } | null };

function fakeClient(answer: (query: Query) => Answer = () => ({ count: 2, error: null })) {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, select: [], filters: [] };
      queries.push(query);
      const builder: Record<string, unknown> = {
        select: (...args: unknown[]) => ((query.select = args), builder),
        then: (resolve: (value: Answer) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve()
            .then(() => answer(query))
            .then(resolve, reject),
      };
      for (const name of ["eq", "gte", "lt", "in", "not", "order", "limit", "range", "or"]) {
        builder[name] = (...args: unknown[]) => (query.filters.push([name, ...args]), builder);
      }
      return builder;
    },
  };
  return { client: client as never, queries };
}

const NOW = new Date("2026-11-18T12:00:00Z");
const ALL = new Set<Permission>(STATISTICS_PERMISSIONS);
const posthog = (overrides: Partial<Record<"enabled" | "downloads" | "signupShare", unknown>> = {}) => ({
  enabled: () => true,
  downloads: vi.fn(async () => Array.from({ length: 12 }, (_, i) => i)),
  signupShare: vi.fn(async () => ({ signups: Array(12).fill(1), visitors: Array(12).fill(10) })),
  ...overrides,
}) as never;

describe("loadStatistics", () => {
  it("gives the admin all seven KPIs, from the user client", async () => {
    const { client, queries } = fakeClient((query) =>
      query.select[0] === "id, created_at, first_reply_at" ? { data: [], error: null } : { count: 2, error: null },
    );
    const { kpis, windows } = await loadStatistics(ALL, "UTC", { client, now: NOW, posthog: posthog() });
    expect(kpis.map((kpi) => kpi.key)).toEqual([...KPI_KEYS]);
    expect(kpis.some((kpi) => "unavailable" in kpi)).toBe(false);
    expect(windows).toHaveLength(12);
    // 12 head counts each for consultations, document requests, registrations; 13 for the newsletter; 1 read for first reply (empty page).
    expect(queries).toHaveLength(12 * 3 + 13 + 1);
    for (const query of queries.filter((q) => q.select[1])) {
      expect(query.select[1]).toEqual({ count: "exact", head: true });
    }
  });

  it("counts each month as a half-open range in the viewer's zone", async () => {
    const { client, queries } = fakeClient();
    await loadStatistics(new Set([PERMISSIONS.TRAINING_MANAGE]), "Asia/Riyadh", { client, now: NOW, posthog: posthog() });
    expect(queries).toHaveLength(12);
    expect(queries.at(-1)).toEqual({
      table: "course_registrations",
      select: ["id", { count: "exact", head: true }],
      filters: [
        ["gte", "created_at", "2026-10-31T21:00:00.000Z"],
        ["lt", "created_at", "2026-11-30T21:00:00.000Z"],
      ],
    });
  });

  it("counts only consultation requests, and only confirmed subscribers", async () => {
    const { client, queries } = fakeClient();
    await loadStatistics(new Set([PERMISSIONS.CONSULTATIONS_VIEW_ALL, PERMISSIONS.CONTENT_MANAGE]), "UTC", {
      client,
      now: NOW,
      posthog: posthog({ enabled: () => false }),
    });
    for (const query of queries.filter((q) => q.table === "consultations")) {
      expect(query.filters).toContainEqual(["eq", "kind", "consultation"]);
    }
    for (const query of queries.filter((q) => q.table === "newsletter_subscribers")) {
      expect(query.filters).toContainEqual(["eq", "status", "confirmed"]);
    }
  });

  // Refused cases: without the permission, no query and no tile.
  it.each(KPI_KEYS.map((key) => [key, KPI_PERMISSIONS[key]] as const))(
    "shows no %s without %s",
    async (key, permission) => {
      const granted = new Set<Permission>(STATISTICS_PERMISSIONS.filter((item) => item !== permission));
      const { client, queries } = fakeClient((query) =>
        query.select[0] === "id, created_at, first_reply_at" ? { data: [], error: null } : { count: 1, error: null },
      );
      const ph = posthog();
      const { kpis } = await loadStatistics(granted, "UTC", { client, now: NOW, posthog: ph });
      expect(kpis.map((kpi) => kpi.key)).not.toContain(key);
      const tables: Record<string, string> = {
        consultations: "consultations",
        firstReply: "consultations",
        documentRequests: "document_requests",
        registrations: "course_registrations",
        newsletter: "newsletter_subscribers",
      };
      if (tables[key]) expect(queries.map((q) => q.table)).not.toContain(tables[key]);
      if (key === "downloads") expect((ph as { downloads: ReturnType<typeof vi.fn> }).downloads).not.toHaveBeenCalled();
      if (key === "signupShare") expect((ph as { signupShare: ReturnType<typeof vi.fn> }).signupShare).not.toHaveBeenCalled();
    },
  );

  it("shows a training coordinator only course registrations", async () => {
    const { client, queries } = fakeClient();
    const { kpis } = await loadStatistics(
      new Set([PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.DOCUMENTS_VIEW]),
      "UTC",
      { client, now: NOW, posthog: posthog() },
    );
    expect(kpis.map((kpi) => kpi.key)).toEqual(["registrations"]);
    expect(new Set(queries.map((q) => q.table))).toEqual(new Set(["course_registrations"]));
  });

  it("makes no client and no query for a member with none of the permissions", async () => {
    vi.mocked(createUserClient).mockClear();
    const { kpis } = await loadStatistics(new Set([PERMISSIONS.DOCUMENTS_VIEW]), "UTC", { now: NOW, posthog: posthog() });
    expect(kpis).toEqual([]);
    expect(createUserClient).not.toHaveBeenCalled();
  });

  it("shows the PostHog tiles as unavailable without the query key, quietly, and the rest work", async () => {
    const log = vi.fn();
    const { client } = fakeClient((query) =>
      query.select[0] === "id, created_at, first_reply_at" ? { data: [], error: null } : { count: 1, error: null },
    );
    const ph = posthog({ enabled: () => false });
    const { kpis } = await loadStatistics(ALL, "UTC", { client, now: NOW, posthog: ph, log });
    expect(kpis.filter((kpi) => "unavailable" in kpi).map((kpi) => kpi.key)).toEqual(["downloads", "signupShare"]);
    expect(kpis.filter((kpi) => !("unavailable" in kpi))).toHaveLength(5);
    expect(log).not.toHaveBeenCalled();
  });

  it("shows a tile as unavailable when its PostHog query or its DB read fails, and logs it", async () => {
    const log = vi.fn();
    const { client } = fakeClient((query) =>
      query.table === "document_requests" ? { count: null, error: { code: "42501" } } : query.select[0] === "id, created_at, first_reply_at" ? { data: [], error: null } : { count: 1, error: null },
    );
    const ph = posthog({ downloads: vi.fn(async () => Promise.reject(new Error("posthog query failed: 500"))) });
    const { kpis } = await loadStatistics(ALL, "UTC", { client, now: NOW, posthog: ph, log });
    expect(kpis.filter((kpi) => "unavailable" in kpi).map((kpi) => kpi.key)).toEqual(["documentRequests", "downloads"]);
    expect(log).toHaveBeenCalledWith("statistics: documentRequests unavailable");
    expect(log).toHaveBeenCalledWith("statistics: downloads unavailable");
  });

  it("passes PostHog the viewer's zone, the month keys and the window's start", async () => {
    const ph = posthog();
    await loadStatistics(new Set([PERMISSIONS.CONTENT_MANAGE]), "Asia/Riyadh", {
      client: fakeClient().client,
      now: NOW,
      posthog: ph,
    });
    const [zone, keys, start] = (ph as { downloads: ReturnType<typeof vi.fn> }).downloads.mock.calls[0]!;
    expect(zone).toBe("Asia/Riyadh");
    expect((keys as string[]).at(-1)).toBe("2026-11");
    expect(start).toBe("2025-11-30T21:00:00.000Z");
  });

  it("averages the hours to first reply per month and over the last 90 days", async () => {
    const rows = [
      { id: "a", created_at: "2026-11-02T00:00:00Z", first_reply_at: "2026-11-02T04:00:00Z" },
      { id: "b", created_at: "2026-11-10T00:00:00Z", first_reply_at: "2026-11-11T00:00:00Z" },
      { id: "c", created_at: "2026-06-01T00:00:00Z", first_reply_at: "2026-06-01T10:00:00Z" },
    ];
    let pages = 0;
    const { client, queries } = fakeClient((query) =>
      query.select[0] === "id, created_at, first_reply_at" ? { data: pages++ === 0 ? rows : [], error: null } : { count: 0, error: null },
    );
    const { kpis } = await loadStatistics(new Set([PERMISSIONS.CONSULTATIONS_VIEW_ALL]), "UTC", {
      client,
      now: NOW,
      posthog: posthog(),
    });
    const reply = kpis.find((kpi) => kpi.key === "firstReply");
    expect(reply).toMatchObject({ recent: 14, capped: false });
    const months = (reply as { months: (number | null)[] }).months;
    expect(months.at(-1)).toBe(14);
    expect(months[6]).toBe(10); // June 2026
    expect(months[0]).toBeNull();
    const read = queries.find((q) => q.select[0] === "id, created_at, first_reply_at")!;
    expect(read.filters).toContainEqual(["not", "first_reply_at", "is", null]);
    expect(read.filters).toContainEqual(["limit", 1000]);
  });

  it("pages after the last row until an empty page, so a lower server row limit can't cut the sample", async () => {
    // The server caps pages at 500: 500, 500, 200, then nothing = 1,200 rows, not capped.
    const sizes = [500, 500, 200, 0];
    let served = 0;
    const { client, queries } = fakeClient((query) => {
      if (query.select[0] !== "id, created_at, first_reply_at") return { count: 0, error: null };
      const size = sizes.shift() ?? 0;
      const data = Array.from({ length: size }, () => {
        served++;
        return { id: `id-${String(served).padStart(5, "0")}`, created_at: "2026-11-02T00:00:00+00:00", first_reply_at: "2026-11-02T02:00:00+00:00" };
      });
      return { data, error: null };
    });
    const { kpis } = await loadStatistics(new Set([PERMISSIONS.CONSULTATIONS_VIEW_ALL]), "UTC", { client, now: NOW, posthog: posthog() });
    const reads = queries.filter((q) => q.select[0] === "id, created_at, first_reply_at");
    expect(reads).toHaveLength(4);
    expect(reads[0]!.filters.some((filter) => filter[0] === "or")).toBe(false);
    // Each later page seeks after the previous page's last (created_at, id).
    expect(reads[1]!.filters).toContainEqual([
      "or",
      'created_at.lt."2026-11-02T00:00:00+00:00",and(created_at.eq."2026-11-02T00:00:00+00:00",id.gt."id-00500")',
    ]);
    expect(reads[2]!.filters).toContainEqual([
      "or",
      'created_at.lt."2026-11-02T00:00:00+00:00",and(created_at.eq."2026-11-02T00:00:00+00:00",id.gt."id-01000")',
    ]);
    expect(reads[3]!.filters).toContainEqual([
      "or",
      'created_at.lt."2026-11-02T00:00:00+00:00",and(created_at.eq."2026-11-02T00:00:00+00:00",id.gt."id-01200")',
    ]);
    expect(kpis.find((kpi) => kpi.key === "firstReply")).toMatchObject({ capped: false, recent: 2 });
  });

  it("stops at 5,000 rows and says so", async () => {
    let served = 0;
    const { client, queries } = fakeClient((query) => {
      const limit = query.filters.find((filter) => filter[0] === "limit")![1] as number;
      const data = Array.from({ length: limit }, () => ({ id: `id-${++served}`, created_at: "2026-11-02T00:00:00Z", first_reply_at: "2026-11-02T01:00:00Z" }));
      return { data, error: null };
    });
    const { kpis } = await loadStatistics(new Set([PERMISSIONS.CONSULTATIONS_VIEW_ALL]), "UTC", { client, now: NOW, posthog: posthog() });
    expect(queries.filter((q) => q.select[0] === "id, created_at, first_reply_at")).toHaveLength(5);
    expect(served).toBe(5000);
    expect(kpis.find((kpi) => kpi.key === "firstReply")).toMatchObject({ capped: true });
  });

  it("shows first reply as unavailable when a later page fails", async () => {
    let reads = 0;
    const log = vi.fn();
    const { client } = fakeClient((query) => {
      // Monthly head counts succeed and don't count as reads.
      if (query.select[0] !== "id, created_at, first_reply_at") return { count: 1, error: null };
      reads++;
      return reads === 1
        ? { data: [{ id: "a", created_at: "2026-11-02T00:00:00Z", first_reply_at: "2026-11-02T01:00:00Z" }], error: null }
        : { data: null, error: { code: "57014" } };
    });
    const { kpis } = await loadStatistics(new Set([PERMISSIONS.CONSULTATIONS_VIEW_ALL]), "UTC", { client, now: NOW, posthog: posthog(), log });
    expect(reads).toBe(2);
    expect(kpis.find((kpi) => kpi.key === "firstReply")).toEqual({ key: "firstReply", unavailable: true });
    // The partial sample isn't shown; the other KPI still is.
    expect(kpis.find((kpi) => kpi.key === "consultations")).toMatchObject({ months: Array(12).fill(1) });
    expect(log).toHaveBeenCalledWith("statistics: firstReply unavailable");
  });
});
