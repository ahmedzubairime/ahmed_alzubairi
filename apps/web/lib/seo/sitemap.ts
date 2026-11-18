import { LOCALES, type Locale } from "@repo/shared";
import type { MetadataRoute } from "next";
import { localizedUrl } from "./metadata";
import { STATIC_PAGES } from "./paths";

/** The DB-backed static pages: listed only in the languages they're published in. */
const CONTENT_PAGES = ["about", "privacy", "terms"] as const;
type ContentPageKey = (typeof CONTENT_PAGES)[number];

export type SitemapInput = {
  /** About, privacy, terms: the languages each is published in. */
  pages: { key: string; locales: Locale[]; lastModified: string | null }[];
  /** Detail items: the path in each language they're public in. */
  items: { paths: Partial<Record<Locale, string>>; lastModified: string | null }[];
};

/**
 * One entry per page per language, each listing the page's real languages
 * as alternates (§6.24): the same rule as the pages' own `hreflang`.
 */
function entries(
  paths: Partial<Record<Locale, string>>,
  lastModified: string | null,
): MetadataRoute.Sitemap {
  const locales = LOCALES.filter((locale) => paths[locale] !== undefined);
  const urls = Object.fromEntries(locales.map((locale) => [locale, localizedUrl(locale, paths[locale]!)]));
  const languages =
    locales.length > 1 ? { ...urls, "x-default": urls["ar"] ?? urls[locales[0]!] } : undefined;
  return locales.map((locale) => ({
    url: urls[locale]!,
    ...(lastModified ? { lastModified } : {}),
    ...(languages ? { alternates: { languages } } : {}),
  }));
}

const bothLanguages = (path: string) => Object.fromEntries(LOCALES.map((locale) => [locale, path]));

export function buildSitemap({ pages, items }: SitemapInput): MetadataRoute.Sitemap {
  const isContentPage = (key: string): key is ContentPageKey =>
    (CONTENT_PAGES as readonly string[]).includes(key);

  const listings = Object.entries(STATIC_PAGES)
    .filter(([key]) => !isContentPage(key))
    .flatMap(([, path]) => entries(bothLanguages(path), null));

  const contentPages = pages.flatMap((page) =>
    isContentPage(page.key)
      ? entries(
          Object.fromEntries(page.locales.map((locale) => [locale, STATIC_PAGES[page.key as ContentPageKey]])),
          page.lastModified,
        )
      : [],
  );

  return [...listings, ...contentPages, ...items.flatMap((item) => entries(item.paths, item.lastModified))];
}
