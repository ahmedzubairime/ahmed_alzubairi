import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { ExpertiseArea } from "@/lib/content";
import type { PostPage } from "@/lib/content/posts";
import { ArticleCard, FilterChips, Pagination, SearchField } from "../listing";
import { CONTAINER, EmptyNote, MoreLink } from "../parts";
import { articlePath, BLOG_PATH, CATEGORY_PARAM, listingQuery, type BlogQuery } from "./query";

/**
 * `/blog` under its hero: search, expertise chips, the article cards and the
 * page links (§6.8). `result` holds only articles public in this language.
 */
export function BlogList({
  result,
  areas,
  query,
}: {
  result: PostPage;
  /** Expertise areas published in this language: the category chips. */
  areas: ExpertiseArea[];
  query: BlogQuery;
}) {
  const t = useTranslations("Blog");
  const kept = listingQuery(query);
  const filtered = query.q !== null || query.category !== null;

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      <div className="grid gap-6">
        <SearchField pathname={BLOG_PATH} value={query.q ?? ""} query={kept} label={t("searchLabel")} />
        {areas.length > 0 && (
          <FilterChips
            label={t("categoriesLabel")}
            pathname={BLOG_PATH}
            param={CATEGORY_PARAM}
            options={areas.map((area) => ({ value: area.slug, label: area.title }))}
            query={kept}
          />
        )}
      </div>

      {/* Announces the new count after a search or a filter, zero included. */}
      <p role="status" className="mt-8 text-sm font-semibold text-text-secondary">
        {(result.total > 0 || filtered) &&
          (query.q
            ? t("searchResults", { count: result.total, q: query.q })
            : t("resultsCount", { count: result.total }))}
      </p>

      {result.total === 0 ? (
        <div className="mt-2 grid justify-items-start gap-4">
          <EmptyNote text={filtered ? t("noResults") : t("empty")} />
          {filtered && <MoreLink href={BLOG_PATH} label={t("clearFilters")} />}
        </div>
      ) : (
        <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {result.posts.map((post) => (
            <li key={post.id} className="flex">
              <ArticleCard
                href={articlePath(post.slug)}
                title={post.title}
                excerpt={post.excerpt}
                category={post.expertise?.title ?? null}
                // Decorative: the title beside it names the article.
                cover={post.coverUrl ? { src: post.coverUrl, alt: "" } : null}
                publishedAt={post.publishedAt}
                readingMinutes={post.readingMinutes}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        pathname={BLOG_PATH}
        page={result.page}
        totalPages={result.pageCount}
        query={kept}
        className="mt-10"
      />
    </div>
  );
}
