import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { formatDate } from "../home/format";
import { FileIcon } from "./icons";
import { CardCover, Heading, LISTING_CARD, MetaLine, TITLE_LINK, type ListingImage } from "./parts";

/** The date and reading time under an article's title, on a card or the article page. */
export function ArticleMeta({
  publishedAt,
  readingMinutes,
  className,
}: {
  publishedAt: string | null;
  readingMinutes: number | null;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();

  return (
    <MetaLine
      className={className}
      items={[
        publishedAt && <time dateTime={publishedAt}>{formatDate(publishedAt, locale)}</time>,
        readingMinutes ? t("readingTime", { minutes: readingMinutes }) : null,
      ]}
    />
  );
}

export type ArticleCardProps = {
  href: string;
  title: string;
  excerpt: string | null;
  /** The expertise area's name, already in the page's language. */
  category: string | null;
  cover: ListingImage | null;
  publishedAt: string | null;
  readingMinutes: number | null;
  /** h2 on a list page, h3 under a section heading (related articles). */
  headingLevel?: 2 | 3;
  className?: string;
};

/** A blog article in a list (§6.8). The whole card opens the article. */
export function ArticleCard({
  href,
  title,
  excerpt,
  category,
  cover,
  publishedAt,
  readingMinutes,
  headingLevel = 2,
  className,
}: ArticleCardProps) {
  return (
    <article className={cx(LISTING_CARD, className)}>
      <CardCover image={cover} fallback={<FileIcon className="size-10" />} />
      <div className="flex flex-1 flex-col p-5">
        {category && (
          <div className="mb-3">
            <Badge>{category}</Badge>
          </div>
        )}
        <Heading level={headingLevel} className="text-xl leading-snug">
          <Link href={href} className={TITLE_LINK}>
            {title}
          </Link>
        </Heading>
        {excerpt && <p className="mt-2 line-clamp-3 text-pretty text-text-secondary">{excerpt}</p>}
        <ArticleMeta publishedAt={publishedAt} readingMinutes={readingMinutes} className="mt-auto pt-4" />
      </div>
    </article>
  );
}
