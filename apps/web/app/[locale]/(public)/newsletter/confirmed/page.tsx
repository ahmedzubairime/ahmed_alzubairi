import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CONTAINER } from "@/components/public/projects";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { ButtonLink } from "@/components/ui";
import { routing } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

/** What `GET /api/newsletter/confirm` may send here. Anything else is `confirmed`. */
const OTHER_STATUSES = ["invalid", "retry"] as const;

function statusOf(value: string | string[] | undefined) {
  return OTHER_STATUSES.find((status) => status === value) ?? "confirmed";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const status = statusOf((await searchParams).status);
  const t = await getTranslations({ locale, namespace: "Newsletter" });
  // A result page: nothing here for a search engine.
  return { title: t(`confirm.${status}.title`), robots: { index: false, follow: false } };
}

/**
 * Where the link in the confirm email lands (§6.15). The page only shows the
 * result the route decided: it reads no token and no subscriber.
 */
export default async function NewsletterConfirmedPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const status = statusOf((await searchParams).status);
  const t = await getTranslations({ locale, namespace: "Newsletter" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <div className={`${CONTAINER} max-w-2xl py-16 md:py-24`}>
        <h1 className="text-3xl md:text-4xl">{t(`confirm.${status}.title`)}</h1>
        <p className="mt-4 text-lg text-text-secondary">{t(`confirm.${status}.text`)}</p>
        <ButtonLink href="/" variant="secondary" className="mt-8">
          {t("confirm.home")}
        </ButtonLink>
      </div>
    </main>
  );
}
