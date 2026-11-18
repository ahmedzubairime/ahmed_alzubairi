import { LOCALES, SITE_NAME, type Locale } from "@repo/shared";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { defaultOgImage, pageMetadata, type PageImage } from "./metadata";
import { STATIC_PAGES, type StaticPageKey } from "./paths";

/**
 * A static or listing page's metadata: title and description from the `Seo`
 * messages in this language (§6.24). Every listing exists in both languages;
 * a page whose content is single-language (about, privacy, terms) passes the
 * languages it really has.
 */
export async function staticPageMetadata(
  locale: Locale,
  key: StaticPageKey,
  languages: readonly Locale[] = LOCALES,
  { page = 1, noindex = false }: { page?: number; noindex?: boolean } = {},
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Seo" });
  // A later page of a listing is its own page: its canonical keeps the page
  // number, and it has no alternates (the other language pages differently).
  const later = page > 1;
  return pageMetadata({
    locale,
    path: later ? `${STATIC_PAGES[key]}?page=${page}` : STATIC_PAGES[key],
    title: t(`pages.${key}.title`),
    description: t(`pages.${key}.description`),
    languages: later ? [locale] : languages,
    noindex,
    image: await defaultShareImage(locale),
  });
}

/**
 * The locale's default share image with its translated alt text. A page that
 * sets `openGraph` replaces the layout's image, alt included, so it names it.
 */
export async function defaultShareImage(locale: Locale): Promise<PageImage> {
  const t = await getTranslations({ locale, namespace: "Seo" });
  return defaultOgImage(locale, t("ogAlt", { siteName: SITE_NAME }));
}
