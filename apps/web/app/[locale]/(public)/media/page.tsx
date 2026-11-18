import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MediaList, parseMediaQuery } from "@/components/public/media";
import { PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { getMediaItems } from "@/lib/content/media";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "media");
}

/**
 * The category lives in the query, which only exists at request time. The
 * items behind it are cached by tag in `lib/content`.
 */
async function MediaFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseMediaQuery(await searchParams);
  const items = await getMediaItems(locale, { category: query.category ?? undefined });
  return <MediaList items={items} query={query} />;
}

function ListLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function Media({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Media" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("title")} intro={<p>{t("intro")}</p>} />
      <Suspense fallback={<ListLoading />}>
        <MediaFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
