import Image from "next/image";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { PostDetail, PostListItem } from "@/lib/content/posts";
import { ArticleCard, ArticleMeta, ShareButtons } from "../listing";
import { CONTAINER, ConsultationCta, PageHero, PageSection } from "../parts";
import { RichText } from "../rich-text";
import { articlePath, BLOG_PATH } from "./query";

/**
 * `/blog/[slug]` (§6.8): title, date, reading time, the body, share buttons,
 * related articles and the consultation call to action. The body is stored
 * Tiptap JSON and goes through `RichText`, never as HTML (§9).
 */
export function ArticlePage({
  post,
  related,
  shareUrl,
}: {
  post: PostDetail;
  /** Up to three articles from the same expertise area, in this language. */
  related: PostListItem[];
  /** The page's full canonical URL, or null when the site address isn't set. */
  shareUrl: string | null;
}) {
  const t = useTranslations("Blog");

  return (
    <>
      <PageHero
        back={{ href: BLOG_PATH, label: t("allArticles") }}
        eyebrow={post.expertise?.title ?? t("title")}
        title={post.title}
        intro={
          <ArticleMeta
            publishedAt={post.publishedAt}
            readingMinutes={post.readingMinutes}
            // The default grey is too faint on the navy band.
            className="text-base text-on-primary/85!"
          />
        }
      />
      <article className={cx(CONTAINER, "grid gap-10 py-12 md:py-16")}>
        {post.coverUrl && (
          <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-lg bg-text/5">
            {/* Decorative: the title above names the article. */}
            <Image
              src={post.coverUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-cover"
            />
          </div>
        )}
        {post.excerpt && <p className="max-w-prose text-pretty text-xl font-semibold">{post.excerpt}</p>}
        <RichText doc={post.body} className="max-w-prose text-lg" />
        {shareUrl && (
          <ShareButtons url={shareUrl} title={post.title} className="border-t border-text/10 pt-6" />
        )}
      </article>
      {related.length > 0 && (
        <div className={cx(CONTAINER, "pb-12 md:pb-16")}>
          <PageSection id="related-articles" title={t("related")}>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <li key={item.id} className="flex">
                  <ArticleCard
                    href={articlePath(item.slug)}
                    title={item.title}
                    excerpt={item.excerpt}
                    category={item.expertise?.title ?? null}
                    cover={item.coverUrl ? { src: item.coverUrl, alt: "" } : null}
                    publishedAt={item.publishedAt}
                    readingMinutes={item.readingMinutes}
                    headingLevel={3}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          </PageSection>
        </div>
      )}
      <ConsultationCta />
    </>
  );
}
