import { SITE_NAME } from "@repo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DESCRIPTION_MAX, localizedUrl, metaDescription, pageMetadata, pageTitle } from "./metadata";
import { siteUrl } from "./site-url";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/");
  vi.stubEnv("VERCEL_URL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL's origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example/app?x=1");
    expect(siteUrl().toString()).toBe("https://site.example/");
  });

  it("falls back to the Vercel URL, then localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "preview-abc.vercel.app");
    expect(siteUrl().toString()).toBe("https://preview-abc.vercel.app/");
    vi.stubEnv("VERCEL_URL", "");
    expect(siteUrl().toString()).toBe("http://localhost:3000/");
  });
});

describe("pageTitle", () => {
  it("adds the site name, but never twice", () => {
    expect(pageTitle("About")).toBe(`About | ${SITE_NAME}`);
    expect(pageTitle(undefined)).toBe(SITE_NAME);
    expect(pageTitle(SITE_NAME)).toBe(SITE_NAME);
    // Replacement patterns in a title stay literal.
    expect(pageTitle("Understanding $& and $1")).toBe(`Understanding $& and $1 | ${SITE_NAME}`);
  });
});

describe("pageMetadata", () => {
  it("gives an absolute canonical for the page's own locale", () => {
    expect(localizedUrl("ar", "/")).toBe("https://site.example/ar");
    const meta = pageMetadata({ locale: "en", path: "/services/x/", languages: ["en"] });
    expect(meta.alternates?.canonical).toBe("https://site.example/en/services/x");
    expect(meta.openGraph).toMatchObject({
      url: "https://site.example/en/services/x",
      siteName: SITE_NAME,
      locale: "en_US",
    });
  });

  it("lists hreflang only for the languages given, x-default → Arabic when both exist", () => {
    const both = pageMetadata({ locale: "en", path: "/about", title: "About", languages: ["ar", "en"] });
    expect(both.alternates?.languages).toEqual({
      ar: "https://site.example/ar/about",
      en: "https://site.example/en/about",
      "x-default": "https://site.example/ar/about",
    });
    expect(both.openGraph).toMatchObject({ alternateLocale: ["ar_SA"] });
    expect(both.title).toEqual({ absolute: `About | ${SITE_NAME}` });
  });

  it("announces no alternates or x-default for a page in one language", () => {
    const one = pageMetadata({ locale: "ar", path: "/blog/x", languages: ["ar"] });
    expect(one.alternates?.languages).toBeUndefined();
    expect(one.openGraph).toMatchObject({ alternateLocale: [] });

    const enOnly = pageMetadata({ locale: "en", path: "/blog/y", languages: ["en"] });
    expect(JSON.stringify(enOnly.alternates)).not.toContain("x-default");
    expect(JSON.stringify(enOnly.alternates)).not.toContain("/ar/");
  });

  it("names the locale's default share image when none is given", () => {
    const meta = pageMetadata({ locale: "ar", path: "/about", languages: ["ar"] });
    const image = { url: "/ar/opengraph-image/default", width: 1200, height: 630 };
    expect(meta.openGraph).toMatchObject({ images: [image] });
    expect(meta.twitter).toMatchObject({ images: [image] });
  });

  it("uses a large Twitter card and the given image", () => {
    const meta = pageMetadata({
      locale: "ar",
      path: "/",
      languages: ["ar", "en"],
      image: { url: "https://cdn.example/a.png", alt: "A" },
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [{ url: "https://cdn.example/a.png" }] });
    expect(meta.openGraph).toMatchObject({ images: [{ url: "https://cdn.example/a.png", alt: "A" }] });
  });

  it("is indexable by default and noindex, nofollow when asked", () => {
    expect(pageMetadata({ locale: "ar", path: "/", languages: ["ar"] }).robots).toBeUndefined();
    expect(pageMetadata({ locale: "ar", path: "/", languages: ["ar"], noindex: true }).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("treats a page outside its own languages as a fallback: noindex, no alternates", () => {
    // An English page showing content that only exists in Arabic.
    const meta = pageMetadata({ locale: "en", path: "/services/x", languages: ["ar"] });
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(meta.alternates).toEqual({ canonical: "https://site.example/en/services/x" });
    expect(meta.openGraph).toMatchObject({ alternateLocale: [] });
  });

  it("uses each language's own path, and drops a language without one", () => {
    const both = pageMetadata({
      locale: "en",
      path: { ar: "/blog/arabic-slug", en: "/blog/english-slug" },
      languages: ["ar", "en"],
      type: "article",
      publishedTime: "2026-01-01T00:00:00Z",
    });
    expect(both.alternates).toEqual({
      canonical: "https://site.example/en/blog/english-slug",
      languages: {
        ar: "https://site.example/ar/blog/arabic-slug",
        en: "https://site.example/en/blog/english-slug",
        "x-default": "https://site.example/ar/blog/arabic-slug",
      },
    });
    expect(both.openGraph).toMatchObject({ type: "article", publishedTime: "2026-01-01T00:00:00Z" });

    // The English page of a post that has only an Arabic slug: a fallback, not a crash.
    const missing = pageMetadata({ locale: "en", path: { ar: "/blog/a" }, languages: ["ar"] });
    expect(missing.robots).toEqual({ index: false, follow: false });
    expect(missing.alternates).toEqual({ canonical: "https://site.example/en" });

    const arOnly = pageMetadata({ locale: "ar", path: { ar: "/blog/a" }, languages: ["ar", "en"] });
    expect(arOnly.alternates).toEqual({ canonical: "https://site.example/ar/blog/a" });
    expect(arOnly.robots).toBeUndefined();
  });
});

describe("metaDescription", () => {
  it("folds whitespace and leaves short text alone", () => {
    expect(metaDescription("  A   short\n text ")).toBe("A short text");
    expect(metaDescription("  ")).toBeUndefined();
    expect(metaDescription(null)).toBeUndefined();
  });

  it("cuts long text on a word boundary with an ellipsis", () => {
    const long = "word ".repeat(80);
    const result = metaDescription(long)!;
    expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(result.endsWith("word…")).toBe(true);
  });

  it("keeps the last whole word, even early in the text", () => {
    expect(metaDescription(`Case notes ${"a".repeat(170)}`)).toBe("Case notes…");
  });

  it("keeps an emoji with its modifier, or drops both", () => {
    const result = metaDescription(`${"a".repeat(158)}👍🏽${"b".repeat(20)}`)!;
    expect(result).toBe(`${"a".repeat(158)}…`);
  });

  it("never splits an emoji when cutting", () => {
    const result = metaDescription(`${"a".repeat(158)}😀${"b".repeat(20)}`)!;
    expect(result).toBe(`${"a".repeat(158)}😀…`);
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
