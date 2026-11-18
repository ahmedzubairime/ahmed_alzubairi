import { SITE_NAME } from "@repo/shared";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { localeDirection, routing } from "@/i18n/routing";
import { OG_SIZE, renderOgImage } from "@/lib/seo/og-image";

// The default share image for every page in the locale. Built from messages
// only: it never reads Supabase.
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "Seo" });
  return [{ id: "default", size: OG_SIZE, contentType, alt: t("ogAlt", { siteName: SITE_NAME }) }];
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "Seo" });
  const png = renderOgImage({
    siteName: SITE_NAME,
    tagline: t("ogTagline"),
    direction: localeDirection(resolved),
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": contentType },
  });
}
