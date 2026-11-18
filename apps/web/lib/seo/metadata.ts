import { SITE_NAME, type Locale } from "@repo/shared";
import type { Metadata } from "next";
import { siteUrl } from "./site-url";

/** Open Graph locale codes for each site language. */
export const OG_LOCALES = { ar: "ar_SA", en: "en_US" } as const satisfies Record<Locale, string>;

/** Every page title reads "Page | Site". The bare site name stays as is. */
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

export function pageTitle(title: string | undefined): string {
  return title && title !== SITE_NAME ? TITLE_TEMPLATE.replace("%s", () => title) : SITE_NAME;
}

/** The page's absolute URL in one language. `path` has no locale: "/" or "/about". */
export function localizedUrl(locale: Locale, path: string): string {
  const clean = path === "/" || path === "" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return new URL(`/${locale}${clean}`, siteUrl()).toString();
}

export type PageImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * The locale's default share image, from `app/[locale]/opengraph-image.tsx`.
 * A page that sets `openGraph` replaces the inherited image, so the helper
 * names it again. Relative: `metadataBase` makes it absolute.
 */
export function defaultOgImage(locale: Locale, alt?: string): PageImage {
  return {
    url: `/${locale}/opengraph-image/default`,
    width: 1200,
    height: 630,
    ...(alt ? { alt } : {}),
  };
}

export type PageMetadataInput = {
  locale: Locale;
  /**
   * The page's path without the locale prefix, e.g. "/" or "/services/x".
   * A page whose path differs per language (a post's per-language slug) gives
   * one per language; a language without a path is never an alternate.
   */
  path: string | Partial<Record<Locale, string>>;
  title?: string;
  description?: string;
  /**
   * Only the languages this page really has (§6.24). When `locale` isn't one
   * of them, the page shows a fallback: it gets `noindex` and no alternates.
   */
  languages: readonly Locale[];
  /** Defaults to the locale's image from `opengraph-image`. */
  image?: PageImage;
  noindex?: boolean;
  type?: "website" | "article";
  /** UTC, for an article. */
  publishedTime?: string | null;
};

/**
 * A page's metadata (§6.24): absolute canonical, `hreflang` only for the
 * languages the page has (`x-default` → Arabic only when both exist), Open
 * Graph and a large Twitter card. `noindex` keeps drafts and private pages out.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  languages,
  image,
  noindex = false,
  type = "website",
  publishedTime,
}: PageMetadataInput): Metadata {
  const pathIn = (language: Locale) => (typeof path === "string" ? path : path[language]);
  const canonical = localizedUrl(locale, pathIn(locale) ?? "/");
  const isFallback = !languages.includes(locale) || pathIn(locale) === undefined;
  // A fallback announces no alternates; it isn't a real version of the page.
  const available: Locale[] = isFallback
    ? [locale]
    : [...new Set(languages)].filter((language) => pathIn(language) !== undefined);
  const fullTitle = pageTitle(title);

  // A fallback has no alternates, so a language without a path is never resolved.
  const hreflang: Record<string, string> = {};
  if (!isFallback) {
    for (const language of available) {
      const languagePath = pathIn(language);
      if (languagePath !== undefined) hreflang[language] = localizedUrl(language, languagePath);
    }
    if (hreflang["ar"] && hreflang["en"]) hreflang["x-default"] = hreflang["ar"];
  }

  const images = [image ?? defaultOgImage(locale)];

  return {
    title: { absolute: fullTitle },
    ...(description ? { description } : {}),
    alternates: {
      canonical,
      // A page in one language has no alternates to announce.
      ...(Object.keys(hreflang).length > 1 ? { languages: hreflang } : {}),
    },
    openGraph: {
      siteName: SITE_NAME,
      title: fullTitle,
      ...(description ? { description } : {}),
      url: canonical,
      locale: OG_LOCALES[locale],
      alternateLocale: available.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
      type,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      ...(description ? { description } : {}),
      images,
    },
    ...(noindex || isFallback ? { robots: NOINDEX } : {}),
  };
}

/** Meta descriptions past this length are cut by search engines anyway. */
export const DESCRIPTION_MAX = 160;

/**
 * Content text as a meta description: whitespace folded, cut on a word
 * boundary at `DESCRIPTION_MAX` with an ellipsis. Undefined when blank.
 */
export function metaDescription(text: string | null | undefined): string | undefined {
  const folded = text?.replace(/\s+/g, " ").trim();
  if (!folded) return undefined;
  if (Array.from(folded).length <= DESCRIPTION_MAX) return folded;
  // Cut on whole graphemes, so an emoji and its modifiers stay together, and
  // within the code-point budget once the ellipsis is added.
  let cut = "";
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(folded)) {
    if (Array.from(cut + segment).length > DESCRIPTION_MAX - 1) break;
    cut += segment;
  }
  // The last word that fits; a hard cut only when there's no space at all.
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** `<meta name="robots" content="noindex, nofollow">`. */
export const NOINDEX = { index: false, follow: false } as const satisfies Metadata["robots"];

/** Metadata for a private or unfinished page: kept out of search engines. */
export const noindexMetadata: Metadata = { robots: NOINDEX };
