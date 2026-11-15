import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client returns every fixture row for the table and ignores filters
 * and order, so each rule below must hold in `resources.ts` itself.
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

const { getResources } = await import("./resources");
const { cacheTag } = await import("next/cache");

const SECRET_KEY = "resources/secret-storage-key.pdf";
const governance = { slug: "governance", title_ar: "الحوكمة", title_en: "Governance", status: "published" };
const relief = { slug: "relief", title_ar: "الإغاثة", title_en: "Relief", status: "published" };

function resource(id: string, fields: Record<string, unknown>) {
  return {
    id,
    expertise_id: "e1",
    expertise_areas: governance,
    kind: "guide",
    title_ar: `مورد ${id}`,
    title_en: `Resource ${id}`,
    description_ar: null,
    description_en: null,
    storage_key: SECRET_KEY,
    access: "direct",
    status: "published",
    created_at: "2026-01-01T00:00:00Z",
    ...fields,
  };
}

beforeEach(() => {
  db.queries = [];
  db.fail = false;
  db.rows = [
    resource("guide", { description_en: "A guide" }),
    resource("template", { kind: "template", access: "email", expertise_id: "e2", expertise_areas: relief }),
    resource("paper", { kind: "working_paper" }),
    resource("arabic-only", { title_en: null }),
    resource("draft", { status: "draft" }),
    resource("bad-kind", { kind: "video" }),
  ];
});

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("getResources", () => {
  it("lists published resources in the locale only", async () => {
    expect(ids(await getResources("ar"))).toEqual(["guide", "template", "paper", "arabic-only"]);
    expect(ids(await getResources("en"))).toEqual(["guide", "template", "paper"]);
  });

  it("never returns storage_key, nor selects it", async () => {
    const all = [...(await getResources("ar")), ...(await getResources("en"))];
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) expect(item).not.toHaveProperty("storage_key");
    expect(JSON.stringify(all)).not.toContain(SECRET_KEY);
    expect(db.queries.every((query) => !query.columns.includes("storage_key"))).toBe(true);
    expect(db.queries.every((query) => !query.columns.includes("*"))).toBe(true);
  });

  it("returns the locale's fields and the expertise area", async () => {
    const [first] = await getResources("en");
    expect(first).toEqual({
      id: "guide",
      kind: "guide",
      title: "Resource guide",
      description: "A guide",
      access: "direct",
      expertise: { slug: "governance", title: "Governance" },
    });
  });

  it("filters by expertise slug and by kind", async () => {
    expect(ids(await getResources("en", { expertise: "relief" }))).toEqual(["template"]);
    expect(ids(await getResources("en", { kind: "working_paper" }))).toEqual(["paper"]);
    expect(ids(await getResources("en", { expertise: "governance", kind: "guide" }))).toEqual(["guide"]);
    expect(await getResources("en", { expertise: "relief", kind: "guide" })).toEqual([]);
    expect(await getResources("en", { expertise: "unknown" })).toEqual([]);
  });

  it("reads published rows, tagged for resources and expertise", async () => {
    await getResources("en");
    expect(db.queries[0]?.filters).toContainEqual(["status", "published"]);
    expect(cacheTag).toHaveBeenCalledWith("content:resources", "content:expertise_areas");
  });

  it("throws on a query error", async () => {
    db.fail = true;
    await expect(getResources("en")).rejects.toThrow("lib/content resources failed");
  });
});
