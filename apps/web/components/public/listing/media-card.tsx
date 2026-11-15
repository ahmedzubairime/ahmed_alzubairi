import type { MediaCategory } from "@repo/shared";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { formatDate } from "../home/format";
import { PlayIcon } from "./icons";
import { ABOVE_LINK, CardCover, Heading, LISTING_CARD, MetaLine, type ListingImage } from "./parts";

/**
 * A 16:9 frame for an embedded video. `src` must already be a safe embed URL
 * (the page builds it from an allowed host); this frame only displays it. It
 * loads lazily, and the sandbox lets the player run but not take the page.
 */
export function VideoEmbed({ src, title, className }: { src: string; title: string; className?: string }) {
  return (
    <div className={cx("relative aspect-video w-full overflow-hidden rounded-md bg-text/10", className)}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        className="absolute inset-0 size-full border-0"
      />
    </div>
  );
}

/**
 * An appearance or event (§6.10). `media` replaces the image with a video
 * frame when the item has one; `action` holds the page's link out.
 */
export function MediaCard({
  category,
  title,
  outlet,
  date,
  image,
  media,
  action,
  headingLevel = 2,
  className,
}: {
  category: MediaCategory;
  title: string;
  /** The outlet or organization. */
  outlet: string | null;
  date: string | null;
  image: ListingImage | null;
  /** A `VideoEmbed`, shown in place of the image. */
  media?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();

  return (
    <article className={cx(LISTING_CARD, className)}>
      {media ? (
        <div className="p-2 pb-0">{media}</div>
      ) : (
        <CardCover image={image} fallback={<PlayIcon className="size-10" />} />
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3">
          <Badge>{t(`mediaCategory.${category}`)}</Badge>
        </div>
        <Heading level={headingLevel} className="text-xl leading-snug">
          {title}
        </Heading>
        <MetaLine
          className="mt-2"
          items={[outlet, date && <time dateTime={date}>{formatDate(date, locale)}</time>]}
        />
        {action && <div className={cx(ABOVE_LINK, "mt-auto flex flex-wrap gap-2 pt-5")}>{action}</div>}
      </div>
    </article>
  );
}
