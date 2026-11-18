import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LanguageFallback } from "@/components/language-switch";
import { formatDate } from "@/components/public/home/format";
import { SeatsMeter } from "@/components/public/listing";
import { CARD, CONTAINER, PageHero, PageSection, TextBlock } from "@/components/public/parts";
import { routeSlug, staticSlugs } from "@/components/public/static-slugs";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { LocalDateTime } from "@/components/training/local-date-time";
import { TRAINING_PATH } from "@/components/training/paths";
import { RegistrationPanel } from "@/components/training/registration-panel";
import { otherLocale, routing } from "@/i18n/routing";
import { getCourse } from "@/lib/content/courses";
import { metaDescription, pageMetadata } from "@/lib/seo";
import { defaultShareImage } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * A placeholder only: Cache Components needs one static param, and the build
 * must never read Supabase. Real slugs render on their first request.
 */
export function generateStaticParams() {
  return staticSlugs([]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  await connection();
  const course = await getCourse(routeSlug(slug), locale);
  if (!course) return {};
  return pageMetadata({
    locale,
    path: `${TRAINING_PATH}/${encodeURIComponent(course.slug)}`,
    title: course.title,
    description: metaDescription(course.description),
    image: await defaultShareImage(locale),
    languages: course.availableIn,
  });
}

/**
 * A course (§6.7). The course itself is public and cached by tag. Only the
 * registration panel reads the session, inside Suspense: it shows the
 * register button, "اكتملت المقاعد", or the registered state with the live
 * session's link. That link is never part of the public content.
 */
export default async function CoursePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  const course = await getCourse(routeSlug(slug), locale);
  if (!course) notFound();
  const [t, tListing, { Training }] = await Promise.all([
    getTranslations({ locale, namespace: "Training" }),
    getTranslations({ locale, namespace: "PublicListing" }),
    getMessages({ locale }),
  ]);
  const recorded = course.type === "recorded";
  const online = course.type === "online_live";

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {/* No translation: the switch goes to the training page instead (§6.1). */}
      {!course.availableIn.includes(otherLocale(locale)) && <LanguageFallback href={TRAINING_PATH} />}
      <PageHero
        back={{ href: TRAINING_PATH, label: t("course.back") }}
        eyebrow={
          recorded
            ? `${tListing("courseType.recorded")} · ${tListing("comingSoon")}`
            : tListing(`courseType.${course.type}`)
        }
        title={course.title}
      />
      <div className={`${CONTAINER} grid gap-12 py-12 md:py-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]`}>
        <div className="space-y-12">
          <PageSection id="course-about" title={t("course.about")}>
            <TextBlock text={course.description} />
          </PageSection>
          {course.audience && (
            <PageSection id="course-audience" title={t("course.audience")}>
              <TextBlock text={course.audience} />
            </PageSection>
          )}
        </div>

        <aside aria-labelledby="course-details" className={`${CARD} h-fit space-y-6`}>
          <h2 id="course-details" className="text-xl">
            {t("course.details")}
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-semibold text-text-secondary">{t("course.type")}</dt>
              <dd className="mt-1">{tListing(`courseType.${course.type}`)}</dd>
            </div>
            {!recorded && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.date")}</dt>
                <dd className="mt-1">
                  {course.startsAt ? (
                    <NextIntlClientProvider locale={locale} messages={{}}>
                      <LocalDateTime
                        value={course.startsAt}
                        fallback={formatDate(course.startsAt, locale)}
                      />
                    </NextIntlClientProvider>
                  ) : (
                    t("course.dateNotSet")
                  )}
                </dd>
              </div>
            )}
            {!recorded && (online || course.place) && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.place")}</dt>
                <dd className="mt-1">{online ? t("course.online") : course.place}</dd>
              </div>
            )}
            {!recorded && course.type !== "custom" && (
              <div>
                <dt className="text-sm font-semibold text-text-secondary">{t("course.seats")}</dt>
                <dd className="mt-1">
                  {course.seats !== null && course.seatsLeft !== null ? (
                    <SeatsMeter left={course.seatsLeft} total={course.seats} />
                  ) : (
                    t("course.noLimit")
                  )}
                </dd>
              </div>
            )}
          </dl>
          <section aria-labelledby="course-registration" className="border-t border-text/10 pt-6">
            <h3 id="course-registration" className="sr-only">
              {t("course.registration")}
            </h3>
            <Suspense fallback={<Skeleton className="h-11 w-full" />}>
              {/* The button is a client component: it gets only its own namespace. */}
              <NextIntlClientProvider locale={locale} messages={{ Training }}>
                <RegistrationPanel course={course} locale={locale} />
              </NextIntlClientProvider>
            </Suspense>
          </section>
        </aside>
      </div>
    </main>
  );
}
