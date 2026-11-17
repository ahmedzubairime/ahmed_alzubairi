import { MEDIA_CATEGORIES } from "@repo/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import type { MediaItem } from "@/lib/content/types";
import { FilterChips, MediaCard, VideoEmbed } from "../listing";
import { LinkIcon, PlayIcon } from "../listing/icons";
import { CONTAINER, EmptyNote, MoreLink } from "../parts";
import { CATEGORY_PARAM, embedUrl, listingQuery, MEDIA_PATH, webUrl, type MediaListQuery } from "./query";

/** A link out, in a new tab. `label` names the item for screen readers. */
function OutLink({ href, text, label, icon }: { href: string; text: string; label: string; icon: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      {icon}
      {text}
    </a>
  );
}

/**
 * `/media` under its hero: the category chips and the cards (§6.10). A video
 * from an allowed host plays in the card; any other video is a link.
 */
export function MediaList({ items, query }: { items: MediaItem[]; query: MediaListQuery }) {
  const t = useTranslations("Media");
  const listing = useTranslations("PublicListing");
  const filtered = query.category !== null;

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      <FilterChips
        label={t("categoriesLabel")}
        pathname={MEDIA_PATH}
        param={CATEGORY_PARAM}
        options={MEDIA_CATEGORIES.map((category) => ({
          value: category,
          label: listing(`mediaCategory.${category}`),
        }))}
        query={listingQuery(query)}
      />

      {/* Announces the new count after a filter, zero included. */}
      <p role="status" className="mt-8 text-sm font-semibold text-text-secondary">
        {(items.length > 0 || filtered) && t("resultsCount", { count: items.length })}
      </p>

      {items.length === 0 ? (
        <div className="mt-2 grid justify-items-start gap-4">
          <EmptyNote text={filtered ? t("noResults") : t("empty")} />
          {filtered && <MoreLink href={MEDIA_PATH} label={t("clearFilters")} />}
        </div>
      ) : (
        <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const embed = embedUrl(item.videoUrl);
            const video = embed ? null : webUrl(item.videoUrl);
            const link = webUrl(item.url);
            const opens = listing("opensInNewTab");
            return (
              <li key={item.id} className="flex">
                <MediaCard
                  category={item.category}
                  title={item.title}
                  outlet={item.outlet}
                  date={item.date}
                  // Decorative: the title beside it names the item.
                  image={item.imageUrl ? { src: item.imageUrl, alt: "" } : null}
                  media={embed ? <VideoEmbed src={embed} title={t("videoTitle", { title: item.title })} /> : undefined}
                  action={
                    video || link ? (
                      <>
                        {video && (
                          <OutLink
                            href={video}
                            text={t("watch")}
                            label={`${t("watchLabel", { title: item.title })} ${opens}`}
                            icon={<PlayIcon className="size-4" />}
                          />
                        )}
                        {link && link !== video && (
                          <OutLink
                            href={link}
                            text={t("open")}
                            label={`${t("openLabel", { title: item.title })} ${opens}`}
                            icon={<LinkIcon className="size-4" />}
                          />
                        )}
                      </>
                    ) : undefined
                  }
                  className="w-full"
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
