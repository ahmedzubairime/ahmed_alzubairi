import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client returns every fixture row for the table and ignores
 * filters, so drafts and missing languages must be dropped by the code itself.
 * It returns only the selected columns, as the real API does.
 */
type Query = { table: string; columns: string; filters: [string, unknown][] };

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  queries: [] as Query[],
}));

const project = (row: Record<string, unknown>, columns: string) =>
  Object.fromEntries(columns.split(",").map((column) => column.trim()).map((column) => [column, row[column]]));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const query: Query = { table, columns: "", filters: [] };
      db.queries.push(query);
      const builder = {
        select: (columns: string) => ((query.columns = columns), builder),
        eq: (column: string, value: unknown) => (query.filters.push([column, value]), builder),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve({ data: (db.rows[table] ?? []).map((row) => project(row, query.columns)), error: null }).then(
            resolve,
            reject,
          ),
      };
      return builder;
    },
  }),
}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const { getSitemapItems, getSitemapPages } = await import("./sitemap");

const doc = (words: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const UPDATED = "2026-11-01T10:00:00Z";

beforeEach(() => {
  db.queries = [];
  db.rows = {
    services: [
      { slug: "both", title_ar: "خدمة", title_en: "Service", summary_ar: "م", summary_en: "S", status: "published", updated_at: UPDATED },
      { slug: "ar-only", title_ar: "خدمة", title_en: null, summary_ar: "م", summary_en: null, status: "published", updated_at: UPDATED },
      { slug: "draft", title_ar: "مسودة", title_en: "Draft", summary_ar: "م", summary_en: "S", status: "draft", updated_at: UPDATED },
    ],
    projects: [
      // Hidden name with no label in English: public in Arabic only.
      { slug: "p", title_ar: "م", title_en: "P", goal_ar: "ه", goal_en: "G", hide_org_name: true, org_label_ar: "جهة", org_label_en: null, status: "published", updated_at: UPDATED },
    ],
    expertise_areas: [
      { slug: "gov", title_ar: "حوكمة", title_en: "Gov", summary_ar: "م", summary_en: "S", status: "hidden", updated_at: UPDATED },
    ],
    posts: [
      { slug_ar: "مقال", slug_en: "post", title_ar: "م", title_en: "P", body_ar: doc("ن"), body_en: doc("T"), status: "published", updated_at: UPDATED },
      { slug_ar: "عربي", slug_en: null, title_ar: "م", title_en: null, body_ar: doc("ن"), body_en: null, status: "published", updated_at: null },
    ],
    courses: [
      { slug: "c", type: "in_person", title_ar: "د", title_en: "C", description_ar: "و", description_en: "D", status: "published", updated_at: UPDATED },
      { slug: "bad-type", type: "nope", title_ar: "د", title_en: "C", description_ar: "و", description_en: "D", status: "published", updated_at: UPDATED },
    ],
    pages: [
      { key: "about", title_ar: "من أنا", title_en: "About", body_ar: doc("ن"), body_en: doc("T"), status: "published", updated_at: UPDATED },
      { key: "privacy", title_ar: "الخصوصية", title_en: null, body_ar: doc("ن"), body_en: null, status: "published", updated_at: UPDATED },
    ],
  };
});

describe("getSitemapItems", () => {
  it("lists published items only, in the languages they're public in", async () => {
    const items = await getSitemapItems();
    expect(items).toEqual([
      { paths: { ar: "/services/both", en: "/services/both" }, lastModified: UPDATED },
      { paths: { ar: "/services/ar-only" }, lastModified: UPDATED },
      { paths: { ar: "/projects/p" }, lastModified: UPDATED },
      {
        paths: { ar: `/blog/${encodeURIComponent("مقال")}`, en: "/blog/post" },
        lastModified: UPDATED,
      },
      { paths: { ar: `/blog/${encodeURIComponent("عربي")}` }, lastModified: null },
      { paths: { ar: "/training/c", en: "/training/c" }, lastModified: UPDATED },
    ]);
    expect(JSON.stringify(items)).not.toContain("draft");
    expect(JSON.stringify(items)).not.toContain("gov");
  });

  it("asks only for published rows, with explicit columns", async () => {
    await getSitemapItems();
    expect(db.queries.map((q) => q.table).sort()).toEqual(
      ["courses", "expertise_areas", "posts", "projects", "services"],
    );
    for (const query of db.queries) {
      expect(query.filters).toEqual([["status", "published"]]);
      expect(query.columns).not.toContain("*");
      expect(query.columns).toContain("updated_at");
    }
  });
});

describe("getSitemapPages", () => {
  it("gives each content page the languages it's published in", async () => {
    expect(await getSitemapPages()).toEqual([
      { key: "about", locales: ["ar", "en"], lastModified: UPDATED },
      { key: "privacy", locales: ["ar"], lastModified: UPDATED },
    ]);
  });
});
