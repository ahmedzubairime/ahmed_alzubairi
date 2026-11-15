import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";
import { withParam, type ListingQuery } from "./links";

const CHIP =
  "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const CHIP_OFF = "border-text/20 text-text hover:bg-text/10";
const CHIP_ON = "border-text bg-text text-background";

export type FilterChip = { value: string; label: string };

/**
 * One row of filter links that set `param`. "All" comes first and clears it.
 * Each chip is a plain link (filters work without JavaScript), keeps the
 * page's other params, and goes back to page 1. On phones the row scrolls
 * sideways instead of wrapping; on wider screens it wraps.
 */
export function FilterChips({
  label,
  pathname,
  param,
  options,
  query = {},
  allLabel,
  className,
}: {
  /** Names the group for screen readers and shows above the chips. */
  label: string;
  pathname: string;
  param: string;
  options: FilterChip[];
  query?: ListingQuery;
  /** Overrides "All". */
  allLabel?: string;
  className?: string;
}) {
  const t = useTranslations("PublicListing");
  const active = query[param] ?? null;
  const chips = [{ value: null, label: allLabel ?? t("filterAll") }, ...options];

  return (
    <nav aria-label={label} className={cx("min-w-0", className)}>
      <p aria-hidden="true" className="mb-2 text-sm font-semibold text-text-secondary">
        {label}
      </p>
      {/* Negative margins let the row scroll to the screen edge on phones; the padding puts the first chip back in line. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:thin] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {chips.map((chip) => {
          const on = chip.value === active || (chip.value === null && !options.some((o) => o.value === active));
          return (
            <li key={chip.value ?? ""} className="shrink-0">
              <Link
                href={{ pathname, query: withParam(query, param, chip.value, ["page"]) }}
                aria-current={on ? "true" : undefined}
                scroll={false}
                className={cx(CHIP, on ? CHIP_ON : CHIP_OFF)}
              >
                {chip.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
