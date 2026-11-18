import type { Locale } from "@repo/shared";
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsletterSignup } from "@/components/newsletter";
import { BlogList, parseBlogQuery } from "@/components/public/blog";
import { PageHero } from "@/components/public/parts";
import { MAIN_CONTENT_ID } from "@/components/skip-link";
import { Skeleton } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { getExpertiseAreas } from "@/lib/content";
import { getPosts } from "@/lib/content/posts";
import { staticPageMetadata } from "@/lib/seo/static-pages";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return staticPageMetadata(locale, "blog");
}

/**
 * The search lives in the query, which only exists at request time. The
 * posts and areas behind it are cached by tag in `lib/content`; a search is
 * free text, so the filtered list itself isn't cached.
 */
async function PostsFromQuery({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const query = parseBlogQuery(await searchParams);
  const [result, areas] = await Promise.all([
    getPosts(locale, { q: query.q ?? undefined, expertise: query.category ?? undefined, page: query.page }),
    getExpertiseAreas(locale),
  ]);
  return <BlogList result={result} areas={areas} query={query} />;
}

function PostsLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function Blog({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Blog" });

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      <PageHero title={t("title")} intro={<p>{t("intro")}</p>} />
      <Suspense fallback={<PostsLoading />}>
        <PostsFromQuery locale={locale} searchParams={searchParams} />
      </Suspense>
      {/* §6.15: the blog is one of the three signup places. Outside the
          Suspense, so it shows while the list loads. */}
      <div className="border-t border-text/10 bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <NewsletterSignup source="blog" className="max-w-xl" />
        </div>
      </div>
    </main>
  );
}
