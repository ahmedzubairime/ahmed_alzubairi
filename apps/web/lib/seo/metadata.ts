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
  /** The page's path without the locale prefix, e.g. "/" or "/services/governance". */
  path: string;
  title?: string;
  description?: string;
  /** Only the languages this page really has (§6.24). The current one is always counted. */
  languages: readonly Locale[];
  /** Defaults to the locale's image from `opengraph-image`. */
  image?: PageImage;
  noindex?: boolean;
  type?: "website" | "article";
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
}: PageMetadataInput): Metadata {
  const canonical = localizedUrl(locale, path);
  const available = [...new Set<Locale>([locale, ...languages])];
  const fullTitle = pageTitle(title);

  const hreflang: Record<string, string> = {};
  for (const language of available) hreflang[language] = localizedUrl(language, path);
  if (available.includes("ar") && available.includes("en")) {
    hreflang["x-default"] = localizedUrl("ar", path);
  }

  const images = [image ?? defaultOgImage(locale)];

  return {
    title: { absolute: fullTitle },
    ...(description ? { description } : {}),
    alternates: {
      canonical,
      // A page in one language has no alternates to announce.
      ...(available.length > 1 ? { languages: hreflang } : {}),
    },
    openGraph: {
      siteName: SITE_NAME,
      title: fullTitle,
      ...(description ? { description } : {}),
      url: canonical,
      locale: OG_LOCALES[locale],
      alternateLocale: available.filter((l) => l !== locale).map((l) => OG_LOCALES[l]),
      type,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      ...(description ? { description } : {}),
      images,
    },
    ...(noindex ? { robots: NOINDEX } : {}),
  };
}

/** `<meta name="robots" content="noindex, nofollow">`. */
export const NOINDEX = { index: false, follow: false } as const satisfies Metadata["robots"];

/** Metadata for a private or unfinished page: kept out of search engines. */
export const noindexMetadata: Metadata = { robots: NOINDEX };
