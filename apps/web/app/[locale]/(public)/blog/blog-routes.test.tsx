// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: null as null | Record<string, unknown>,
  getPost: vi.fn(),
  getPosts: vi.fn(),
  getRelatedPosts: vi.fn(),
  list: vi.fn(),
  article: vi.fn(),
}));

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale: string }) => (key: string) => `${locale}:${key}`,
}));
vi.mock("@/components/language-switch", () => ({
  LanguageFallback: ({ href }: { href: string }) => <span data-testid="fallback">{href}</span>,
}));
vi.mock("@/components/public/parts", () => ({ PageHero: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ui", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/public/blog", async () => ({
  ...(await vi.importActual<typeof import("@/components/public/blog/query")>("@/components/public/blog/query")),
  BlogList: (props: unknown) => (mocks.list(props), <p>list</p>),
  ArticlePage: (props: unknown) => (mocks.article(props), <p>article</p>),
}));
vi.mock("@/lib/content", () => ({ getExpertiseAreas: async () => [{ id: "a1", slug: "governance", title: "G", summary: "" }] }));
vi.mock("@/lib/content/posts", () => ({
  getPost: mocks.getPost,
  getPosts: mocks.getPosts,
  getRelatedPosts: mocks.getRelatedPosts,
}));

const list = await import("./page");
const article = await import("./[slug]/page");

const post = (fields: Record<string, unknown> = {}) => ({
  id: "p1",
  slug: "first-post",
  title: "First post",
  excerpt: "An excerpt",
  coverUrl: "https://cdn.example/c.jpg",
  publishedAt: "2026-03-01T00:00:00Z",
  expertiseId: "a1",
  availableIn: ["ar", "en"],
  slugs: { ar: "مقال", en: "first-post" },
  ...fields,
});
const params = (locale: string, slug = "first-post") => ({ params: Promise.resolve({ locale, slug }) });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("/blog/[slug]", () => {
  it("reads the post by the decoded slug, in the page's language, with its related posts", async () => {
    mocks.getPost.mockResolvedValue(post({ slug: "مقال" }));
    mocks.getRelatedPosts.mockResolvedValue([{ id: "r1" }]);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example");
    render(await article.default(params("ar", "%D9%85%D9%82%D8%A7%D9%84")));
    expect(mocks.getPost).toHaveBeenCalledWith("مقال", "ar");
    expect(mocks.getRelatedPosts).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), "ar");
    expect(mocks.article).toHaveBeenCalledWith(
      expect.objectContaining({
        related: [{ id: "r1" }],
        shareUrl: "https://site.example/ar/blog/%D9%85%D9%82%D8%A7%D9%84",
      }),
    );
  });

  it("sends the switch to the translation's own slug", async () => {
    mocks.getPost.mockResolvedValue(post());
    mocks.getRelatedPosts.mockResolvedValue([]);
    render(await article.default(params("en")));
    expect(screen.getByTestId("fallback").textContent).toBe("/blog/%D9%85%D9%82%D8%A7%D9%84");
  });

  it("sends the switch to the blog when the article has one language", async () => {
    mocks.getPost.mockResolvedValue(post({ availableIn: ["ar"], slugs: { ar: "مقال" } }));
    mocks.getRelatedPosts.mockResolvedValue([]);
    render(await article.default(params("ar", "مقال")));
    expect(screen.getByTestId("fallback").textContent).toBe("/blog");
  });

  it("is not found for a slug that isn't public in this language, or an unknown locale", async () => {
    mocks.getPost.mockResolvedValue(null);
    await expect(article.default(params("en", "مقال"))).rejects.toThrow("NOT_FOUND");
    await expect(article.default(params("fr"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.article).not.toHaveBeenCalled();
  });

  it("builds metadata from the post, with the canonical URL and both languages", async () => {
    mocks.getPost.mockResolvedValue(post());
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example");
    expect(await article.generateMetadata(params("en"))).toEqual({
      title: "First post",
      description: "An excerpt",
      alternates: {
        canonical: "https://site.example/en/blog/first-post",
        languages: {
          ar: "https://site.example/ar/blog/%D9%85%D9%82%D8%A7%D9%84",
          en: "https://site.example/en/blog/first-post",
        },
      },
      openGraph: {
        type: "article",
        title: "First post",
        description: "An excerpt",
        url: "https://site.example/en/blog/first-post",
        publishedTime: "2026-03-01T00:00:00Z",
        images: ["https://cdn.example/c.jpg"],
      },
    });
  });

  it("has empty metadata for a missing post", async () => {
    mocks.getPost.mockResolvedValue(null);
    expect(await article.generateMetadata(params("en"))).toEqual({});
  });
});

describe("/blog", () => {
  it("has a title and description per language", async () => {
    const props = { params: Promise.resolve({ locale: "ar" }), searchParams: Promise.resolve({}) };
    expect(await list.generateMetadata(props)).toEqual({ title: "ar:title", description: "ar:description" });
  });

  it("is not found for an unknown locale", async () => {
    const props = { params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) };
    await expect(list.default(props)).rejects.toThrow("NOT_FOUND");
  });
});
