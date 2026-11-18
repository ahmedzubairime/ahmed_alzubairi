import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CONTAINER, PageHero, PageSection } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { CourseList } from "@/components/training/course-list";
import { CustomRequestForm } from "@/components/training/custom-request-form";
import { parseTypeFilter } from "@/components/training/data";
import { CUSTOM_TRAINING_ID } from "@/components/training/paths";
import { routing } from "@/i18n/routing";
import { getCourses } from "@/lib/content/courses";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "training");
}

/**
 * The type filter lives in the query, which only exists at request time. The
 * courses behind it are cached by tag in `lib/content`.
 */
async function CoursesFromQuery({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Promise<SearchParams>;
}) {
  const type = parseTypeFilter((await searchParams).type);
  return <CourseList courses={await getCourses(locale)} type={type} />;
}

function CoursesLoading() {
  return (
    <div aria-busy="true" className={`${CONTAINER} grid gap-6 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3`}>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** §6.7: the courses, then the custom training request form. It reads no session. */
export default async function TrainingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, { Training }] = await Promise.all([
    getTranslations({ locale, namespace: "Training" }),
    getMessages({ locale }),
  ]);

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("title")} intro={<p>{t("intro")}</p>} />
      <Suspense fallback={<CoursesLoading />}>
        <CoursesFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
      <div className="border-t border-text/10 bg-surface">
        <div className={`${CONTAINER} py-12 md:py-16`}>
          <PageSection id={CUSTOM_TRAINING_ID} title={t("custom.title")} className="scroll-mt-24">
            <p className="mb-8 max-w-prose text-pretty text-text-secondary">{t("custom.intro")}</p>
            {/* The form is a client component: it gets only its own namespace. */}
            <NextIntlClientProvider messages={{ Training }}>
              <CustomRequestForm />
            </NextIntlClientProvider>
          </PageSection>
        </div>
      </div>
    </main>
  );
}
