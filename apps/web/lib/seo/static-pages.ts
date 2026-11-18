import { LOCALES, type Locale } from "@repo/shared";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { pageMetadata } from "./metadata";
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
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Seo" });
  return pageMetadata({
    locale,
    path: STATIC_PAGES[key],
    title: t(`pages.${key}.title`),
    description: t(`pages.${key}.description`),
    languages,
  });
}
