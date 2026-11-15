import { useFormatter, useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { ChevronBackIcon, ChevronForwardIcon } from "./icons";
import { pageItems, withParam, type ListingQuery } from "./links";

const ITEM =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-md px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Previous, page numbers and next, as links that set `page` and keep the
 * page's other params. Page 1 has no `page` param. On phones only previous,
 * "page 2 of 9" and next show; the numbers join from `sm` up. Hidden when
 * there's one page.
 */
export function Pagination({
  pathname,
  page,
  totalPages,
  query = {},
  className,
}: {
  pathname: string;
  page: number;
  totalPages: number;
  query?: ListingQuery;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const format = useFormatter();
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const href = (p: number) => ({
    pathname,
    query: withParam(query, "page", p > 1 ? String(p) : null),
  });
  const n = (value: number) => format.number(value);

  return (
    <nav aria-label={t("paginationLabel")} className={cx("flex items-center justify-between gap-2 sm:justify-center", className)}>
      {current > 1 ? (
        <Link href={href(current - 1)} rel="prev" className={cx(ITEM, "border border-text/20 hover:bg-text/10")}>
          <ChevronBackIcon className="size-4" />
          {t("previous")}
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(ITEM, "border border-text/10 text-text-secondary opacity-60")}>
          <ChevronBackIcon className="size-4" />
          {t("previous")}
        </span>
      )}

      <p className="text-sm font-semibold text-text-secondary sm:hidden">
        {t("pageOf", { page: n(current), total: n(totalPages) })}
      </p>

      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(current, totalPages).map((item) =>
          item.kind === "gap" ? (
            <li key={item.key} aria-hidden="true" className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={item.page}>
              <Link
                href={href(item.page)}
                aria-current={item.page === current ? "page" : undefined}
                aria-label={t("page", { page: n(item.page) })}
                className={cx(ITEM, item.page === current ? "bg-text text-background" : "hover:bg-text/10")}
              >
                {n(item.page)}
              </Link>
            </li>
          ),
        )}
      </ul>

      {current < totalPages ? (
        <Link href={href(current + 1)} rel="next" className={cx(ITEM, "border border-text/20 hover:bg-text/10")}>
          {t("next")}
          <ChevronForwardIcon className="size-4" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cx(ITEM, "border border-text/10 text-text-secondary opacity-60")}>
          {t("next")}
          <ChevronForwardIcon className="size-4" />
        </span>
      )}
    </nav>
  );
}
