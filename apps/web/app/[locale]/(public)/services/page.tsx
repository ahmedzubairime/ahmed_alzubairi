import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ServicesListPage } from "@/components/public/pages";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { routing } from "@/i18n/routing";
import { getServices } from "@/lib/content";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "services");
}

export default async function Services({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Renders on request: the build never reads Supabase. Reads stay cached by tag.
  await connection();

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <ServicesListPage services={await getServices(locale)} />
    </main>
  );
}
