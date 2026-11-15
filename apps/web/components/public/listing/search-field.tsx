import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { buttonClasses } from "@/components/ui";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { getPathname } from "@/i18n/navigation";
import { SearchIcon } from "./icons";
import type { ListingQuery } from "./links";

/**
 * A GET form that submits `q` to `pathname`, so search works without
 * JavaScript and the URL can be shared. `query` holds the page's other params
 * (a category, say): they ride along as hidden fields. `page` never does, so
 * a new search starts on page 1.
 */
export function SearchField({
  pathname,
  value = "",
  query = {},
  label,
  className,
}: {
  /** The list page, without the locale: `/blog`. */
  pathname: string;
  /** The current search, shown in the field. */
  value?: string;
  query?: ListingQuery;
  /** Overrides the default "Search" label, e.g. "Search articles". */
  label?: string;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const locale = useLocale();
  const id = useId();
  const action = getPathname({ href: pathname, locale });
  const kept = Object.entries(query).filter(
    (entry): entry is [string, string] => entry[0] !== "q" && entry[0] !== "page" && !!entry[1],
  );

  return (
    <form role="search" method="get" action={action} className={cx("flex w-full max-w-xl gap-2", className)}>
      <label htmlFor={id} className="sr-only">
        {label ?? t("searchLabel")}
      </label>
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-text-secondary" />
        <input
          id={id}
          type="search"
          name="q"
          defaultValue={value}
          placeholder={t("searchPlaceholder")}
          enterKeyHint="search"
          className={cx(
            "h-11 w-full rounded-md border border-text/30 bg-surface ps-10 pe-3 text-base text-text placeholder:text-text-secondary",
            FOCUS_RING,
          )}
        />
      </div>
      {kept.map(([key, current]) => (
        <input key={key} type="hidden" name={key} value={current} />
      ))}
      <button type="submit" className={buttonClasses({ variant: "secondary" })}>
        {t("searchSubmit")}
      </button>
    </form>
  );
}
