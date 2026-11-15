import type { CourseType } from "@repo/shared";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { formatDate } from "../home/format";
import { CalendarIcon, PlaceIcon, ScreenIcon } from "./icons";
import { seatsLeftRatio } from "./links";
import { ABOVE_LINK, Heading, LISTING_CARD, TITLE_LINK } from "./parts";

/** Seats left as a bar and a sentence. The sentence carries the meaning; the bar helps scanning. */
export function SeatsMeter({ left, total, className }: { left: number; total: number; className?: string }) {
  const t = useTranslations("PublicListing");
  const format = useFormatter();
  const shown = Math.min(Math.max(left, 0), total);
  const text = t("seatsLeft", { left: shown, total: format.number(total) });

  return (
    <div className={className}>
      <p className="text-sm font-semibold">{text}</p>
      <div
        role="meter"
        aria-label={t("seatsMeter")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={shown}
        aria-valuetext={text}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-text/10"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none"
          style={{ width: `${seatsLeftRatio(shown, total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export type CourseCardProps = {
  href: string;
  type: CourseType;
  title: string;
  description: string | null;
  /** When the course starts, as stored. */
  startsAt: string | null;
  /** The place, for an in-person course. Online courses show "Online". */
  place: string | null;
  /** Seats left and the total. Null when the course has no seat limit. */
  seats: { left: number; total: number } | null;
  /** The page's register button. Replaced by "Fully booked" when no seats are left. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
  className?: string;
};

/**
 * A course (§6.7). A recorded course shows only a "Coming soon" badge: no
 * date, seats or registration this release. A full course shows "Fully
 * booked" in place of the register button.
 */
export function CourseCard({
  href,
  type,
  title,
  description,
  startsAt,
  place,
  seats,
  action,
  headingLevel = 2,
  className,
}: CourseCardProps) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const recorded = type === "recorded";
  const full = !recorded && seats !== null && seats.left <= 0;
  const online = type === "online_live";

  return (
    <article className={cx(LISTING_CARD, "p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t(`courseType.${type}`)}</Badge>
        {recorded && <Badge tone="strong">{t("comingSoon")}</Badge>}
      </div>
      <Heading level={headingLevel} className="mt-3 text-xl leading-snug">
        <Link href={href} className={TITLE_LINK}>
          {title}
        </Link>
      </Heading>
      {description && <p className="mt-2 line-clamp-3 text-pretty text-text-secondary">{description}</p>}

      {!recorded && (startsAt || place || online) && (
        <dl className="mt-4 grid gap-2 text-sm">
          {startsAt && (
            <div className="flex items-center gap-2">
              <dt>
                <CalendarIcon className="size-4 text-text-secondary" />
                <span className="sr-only">{t("date")}</span>
              </dt>
              <dd>
                <time dateTime={startsAt}>{formatDate(startsAt, locale)}</time>
              </dd>
            </div>
          )}
          {(online || place) && (
            <div className="flex items-center gap-2">
              <dt>
                {online ? (
                  <ScreenIcon className="size-4 text-text-secondary" />
                ) : (
                  <PlaceIcon className="size-4 text-text-secondary" />
                )}
                <span className="sr-only">{t("place")}</span>
              </dt>
              <dd>{online ? t("online") : place}</dd>
            </div>
          )}
        </dl>
      )}

      {!recorded && seats && seats.total > 0 && <SeatsMeter left={seats.left} total={seats.total} className="mt-4" />}

      {!recorded && (full || action) && (
        <div className={cx(ABOVE_LINK, "mt-auto flex flex-wrap gap-2 pt-5")}>
          {full ? (
            <span className="inline-flex h-11 w-full items-center justify-center rounded-md border border-dashed border-text/40 px-4 font-semibold text-text-secondary">
              {t("courseFull")}
            </span>
          ) : (
            action
          )}
        </div>
      )}
    </article>
  );
}
