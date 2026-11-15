import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The fake client returns every fixture row for the table and ignores filters
 * and order, so each rule below must hold in `posts.ts` itself.
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

const { getPost, getPosts, getRelatedPosts, hasPost } = await import("./posts");
const { cacheTag } = await import("next/cache");

const doc = (words: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: words }] }],
});
const governance = { slug: "governance", title_ar: "الحوكمة", title_en: "Governance", status: "published" };
const relief = { slug: "relief", title_ar: "الإغاثة", title_en: "Relief", status: "published" };
const draftArea = { slug: "hidden-area", title_ar: "مسودة", title_en: "Draft", status: "draft" };

function post(id: string, fields: Record<string, unknown>) {
  return {
    id,
    slug_ar: `${id}-ar`,
    slug_en: `${id}-en`,
    expertise_id: "e1",
    expertise_areas: governance,
    title_ar: `عنوان ${id}`,
    title_en: `Title ${id}`,
    excerpt_ar: null,
    excerpt_en: null,
    body_ar: doc("نص"),
    body_en: doc("Text"),
    cover_path: null,
    reading_minutes_ar: 4,
    reading_minutes_en: 5,
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    status: "published",
    ...fields,
  };
}

beforeEach(() => {
  db.queries = [];
  db.fail = false;
  db.rows = [
    post("both", { published_at: "2026-03-01T00:00:00Z", excerpt_en: "Board governance in practice", excerpt_ar: "الحوكمة في المجالس" }),
    post("arabic-only", { slug_en: null, title_en: null, body_en: null, published_at: "2026-02-01T00:00:00Z", title_ar: "الإدارة الرشيدة" }),
    post("english-only", { slug_ar: null, title_ar: null, body_ar: null, published_at: "2026-04-01T00:00:00Z", title_en: "Humanitarian aid", expertise_id: "e2", expertise_areas: relief }),
    post("empty-body-en", { body_en: { type: "doc", content: [] }, published_at: "2025-12-01T00:00:00Z" }),
    post("draft", { status: "draft", published_at: "2026-05-01T00:00:00Z" }),
    post("old", { published_at: "2025-01-01T00:00:00Z" }),
    post("no-area", { expertise_id: null, expertise_areas: null, published_at: "2025-06-01T00:00:00Z" }),
    post("draft-area", { expertise_id: "e3", expertise_areas: draftArea }),
  ];
});

const ids = (posts: { id: string }[]) => posts.map((item) => item.id);

describe("getPosts", () => {
  it("lists only published posts whose language fields are filled, newest first", async () => {
    expect(ids((await getPosts("ar")).posts)).toEqual(["both", "arabic-only", "draft-area", "empty-body-en", "no-area", "old"]);
    expect(ids((await getPosts("en")).posts)).toEqual(["english-only", "both", "draft-area", "no-area", "old"]);
  });

  it("returns an Arabic-only post for ar and not for en", async () => {
    expect(ids((await getPosts("ar")).posts)).toContain("arabic-only");
    expect(ids((await getPosts("en")).posts)).not.toContain("arabic-only");
    expect(await getPost("arabic-only-ar", "ar")).not.toBeNull();
    expect(await getPost("arabic-only-ar", "en")).toBeNull();
    expect(await getPost("arabic-only-en", "en")).toBeNull();
  });

  it("returns the locale's slug, title and reading time", async () => {
    const [first] = (await getPosts("ar", { q: "مجالس" })).posts;
    expect(first).toMatchObject({ slug: "both-ar", title: "عنوان both", readingMinutes: 4 });
    const [english] = (await getPosts("en", { q: "board" })).posts;
    expect(english).toMatchObject({ slug: "both-en", readingMinutes: 5, expertise: { slug: "governance", title: "Governance" } });
  });

  it("searches the title and the excerpt, ignoring case and Arabic letter variants", async () => {
    expect(ids((await getPosts("en", { q: "  BOARD " })).posts)).toEqual(["both"]);
    expect(ids((await getPosts("en", { q: "humanitarian" })).posts)).toEqual(["english-only"]);
    expect(ids((await getPosts("ar", { q: "الادارة" })).posts)).toEqual(["arabic-only"]);
    expect(ids((await getPosts("en", { q: "nothing matches" })).posts)).toEqual([]);
    expect((await getPosts("en", { q: "   " })).total).toBe(5);
  });

  it("filters by a published expertise area's slug", async () => {
    expect(ids((await getPosts("en", { expertise: "relief" })).posts)).toEqual(["english-only"]);
    expect(ids((await getPosts("en", { expertise: "governance" })).posts)).toEqual(["both", "old"]);
    expect((await getPosts("en", { expertise: "hidden-area" })).posts).toEqual([]);
  });

  it("combines search and the expertise filter", async () => {
    expect(ids((await getPosts("en", { expertise: "relief", q: "board" })).posts)).toEqual([]);
    expect(ids((await getPosts("en", { expertise: "governance", q: "board" })).posts)).toEqual(["both"]);
  });

  it("paginates and clamps the page", async () => {
    const second = await getPosts("en", { page: 2, pageSize: 2 });
    expect(ids(second.posts)).toEqual(["draft-area", "no-area"]);
    expect(second).toMatchObject({ total: 5, page: 2, pageSize: 2, pageCount: 3 });
    expect((await getPosts("en", { page: 99, pageSize: 2 })).page).toBe(3);
    expect((await getPosts("en", { page: 0, pageSize: 2 })).page).toBe(1);
    expect(await getPosts("en", { q: "nothing" })).toMatchObject({ posts: [], total: 0, page: 1, pageCount: 1 });
  });

  it("hides a draft expertise area but keeps the post", async () => {
    const item = (await getPosts("en")).posts.find((entry) => entry.id === "draft-area");
    expect(item?.expertise).toBeNull();
  });

  it("reads published rows with explicit columns, tagged for posts and expertise", async () => {
    await getPosts("ar");
    const [query] = db.queries;
    expect(query?.columns).not.toContain("*");
    expect(query?.filters).toContainEqual(["status", "published"]);
    expect(cacheTag).toHaveBeenCalledWith("content:posts", "content:expertise_areas");
  });

  it("throws on a query error", async () => {
    db.fail = true;
    await expect(getPosts("ar")).rejects.toThrow("lib/content posts failed");
  });
});

describe("getPost", () => {
  it("reads one post by the locale's slug, with both slugs for the switch", async () => {
    const found = await getPost("both-en", "en");
    expect(found).toMatchObject({ id: "both", title: "Title both", availableIn: ["ar", "en"], slugs: { ar: "both-ar", en: "both-en" } });
    expect(found?.body).toEqual(doc("Text"));
    expect(db.queries[0]?.filters).toContainEqual(["slug_en", "both-en"]);
  });

  it("lists only the languages the post is public in", async () => {
    const found = await getPost("arabic-only-ar", "ar");
    expect(found).toMatchObject({ availableIn: ["ar"], slugs: { ar: "arabic-only-ar" } });
  });

  it("returns null for a draft, an empty body, or another language's slug", async () => {
    expect(await getPost("draft-en", "en")).toBeNull();
    expect(await getPost("empty-body-en-en", "en")).toBeNull();
    expect(await getPost("both-ar", "en")).toBeNull();
  });
});

describe("getRelatedPosts", () => {
  it("returns up to three other posts in the same area and language, newest first", async () => {
    db.rows.push(
      post("g1", { published_at: "2026-06-01T00:00:00Z" }),
      post("g2", { published_at: "2026-07-01T00:00:00Z" }),
    );
    const related = await getRelatedPosts({ id: "both", expertiseId: "e1" }, "en");
    expect(ids(related)).toEqual(["g2", "g1", "old"]);
  });

  it("keeps to the language", async () => {
    const related = await getRelatedPosts({ id: "both", expertiseId: "e1" }, "ar");
    expect(ids(related)).toEqual(["arabic-only", "empty-body-en", "old"]);
    expect(ids(await getRelatedPosts({ id: "both", expertiseId: "e1" }, "en"))).toEqual(["old"]);
  });

  it("returns none for a post with no area", async () => {
    expect(await getRelatedPosts({ id: "no-area", expertiseId: null }, "en")).toEqual([]);
  });
});

describe("hasPost", () => {
  it("agrees with getPost", async () => {
    expect(await hasPost("both-en", "en")).toBe(true);
    expect(await hasPost("arabic-only-ar", "ar")).toBe(true);
    expect(await hasPost("arabic-only-ar", "en")).toBe(false);
    expect(await hasPost("draft-en", "en")).toBe(false);
    expect(await hasPost("empty-body-en-en", "en")).toBe(false);
  });

  it("reads only the rule's columns, and passes the signal", async () => {
    const controller = new AbortController();
    await hasPost("both-en", "en", controller.signal);
    expect(db.queries[0]?.columns).toBe("slug_en, status, title_en, body_en");
    expect(db.queries[0]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(hasPost("both-en", "en", controller.signal)).rejects.toThrow();
  });
});
