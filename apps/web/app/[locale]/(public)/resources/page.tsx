import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHero } from "@/components/public/parts";
import { parseResourcesQuery, ResourcesList } from "@/components/public/resources";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas } from "@/lib/content";
import { getResources } from "@/lib/content/resources";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Resources" });
  return { title: t("title"), description: t("description") };
}

/**
 * The filters live in the query, which only exists at request time. The
 * resources and areas behind them are cached by tag in `lib/content`.
 */
async function ResourcesFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseResourcesQuery(await searchParams);
  const [resources, areas, messages] = await Promise.all([
    getResources(locale, { expertise: query.area ?? undefined, kind: query.kind ?? undefined }),
    getExpertiseAreas(locale),
    getMessages({ locale }),
  ]);
  // The download buttons and the email gate are client components that read
  // `Resources`; the root layout gives the browser only Header, Nav and Error.
  // The browser gets only this namespace.
  return (
    <NextIntlClientProvider locale={locale} messages={{ Resources: messages.Resources }}>
      <ResourcesList resources={resources} areas={areas} query={query} />
    </NextIntlClientProvider>
  );
}

function ListLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-56 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function Resources({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Resources" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("title")} intro={<p>{t("intro")}</p>} />
      <Suspense fallback={<ListLoading />}>
        <ResourcesFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
