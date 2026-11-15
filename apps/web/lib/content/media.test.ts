import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client returns every fixture row for the table and ignores filters
 * and order, so each rule below must hold in `media.ts` itself.
 */
type Query = { table: string; columns: string; filters: [string, unknown][]; signal?: AbortSignal };

const db = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  queries: [] as Query[],
  fail: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query: Query = { table, columns: "", filters: [] };
      db.queries.push(query);
      const builder = {
        select: (columns: string) => ((query.columns = columns), builder),
        eq: (column: string, value: unknown) => (query.filters.push([column, value]), builder),
        order: () => builder,
        limit: () => builder,
        abortSignal: (signal: AbortSignal) => ((query.signal = signal), builder),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(
            db.fail || query.signal?.aborted
              ? { data: null, error: { code: "PGRST000" } }
              : { data: db.rows, error: null },
          ).then(resolve, reject),
      };
      return builder;
    },
  }),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const { getMediaItems } = await import("./media");
const { cacheTag } = await import("next/cache");

function item(id: string, fields: Record<string, unknown>) {
  return {
    id,
    category: "media",
    title_ar: `ظهور ${id}`,
    title_en: `Item ${id}`,
    outlet_ar: null,
    outlet_en: null,
    date: "2026-01-01",
    image_path: null,
    url: "https://example.com/item",
    video_url: null,
    status: "published",
    created_at: "2026-01-01T00:00:00Z",
    ...fields,
  };
}

beforeEach(() => {
  db.queries = [];
  db.fail = false;
  db.rows = [
    item("interview", { date: "2026-02-01", outlet_en: "Example TV" }),
    item("event", { category: "events", date: "2026-05-01" }),
    item("conference", { category: "conferences", date: "2026-03-01" }),
    item("undated", { date: null, created_at: "2024-01-01T00:00:00Z" }),
    item("arabic-only", { title_en: null, date: "2026-04-01" }),
    item("draft", { status: "draft", date: "2026-06-01" }),
    item("bad-category", { category: "podcast" }),
  ];
});

const ids = (items: { id: string }[]) => items.map((entry) => entry.id);

describe("getMediaItems", () => {
  it("lists published items in the locale, newest first", async () => {
    expect(ids(await getMediaItems("ar"))).toEqual(["event", "arabic-only", "conference", "interview", "undated"]);
    expect(ids(await getMediaItems("en"))).toEqual(["event", "conference", "interview", "undated"]);
  });

  it("returns the locale's fields", async () => {
    const found = (await getMediaItems("en")).find((entry) => entry.id === "interview");
    expect(found).toEqual({
      id: "interview",
      category: "media",
      title: "Item interview",
      outlet: "Example TV",
      date: "2026-02-01",
      imageUrl: null,
      url: "https://example.com/item",
      videoUrl: null,
    });
  });

  it("filters by category", async () => {
    expect(ids(await getMediaItems("en", { category: "events" }))).toEqual(["event"]);
    expect(ids(await getMediaItems("en", { category: "media" }))).toEqual(["interview", "undated"]);
    expect(ids(await getMediaItems("ar", { category: "media" }))).toEqual(["arabic-only", "interview", "undated"]);
  });

  it("reads published rows with explicit columns, tagged for media", async () => {
    await getMediaItems("en");
    expect(db.queries[0]?.columns).not.toContain("*");
    expect(db.queries[0]?.filters).toContainEqual(["status", "published"]);
    expect(cacheTag).toHaveBeenCalledWith("content:media_items");
  });

  it("throws on a query error", async () => {
    db.fail = true;
    await expect(getMediaItems("en")).rejects.toThrow("lib/content media_items failed");
  });
});
