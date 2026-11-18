import { cx } from "./cx";

export type MonthlyValue = {
  /** The month, formatted by the caller with Intl, e.g. "Mar". */
  label: string;
  value: number;
};

/** Up to five round ticks from zero, using steps of 1, 2, 2.5 or 5 × 10ⁿ. */
export function niceScale(max: number, wholeNumbers = true): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  let step = nice * power;
  if (wholeNumbers) step = Math.max(1, Math.ceil(step));
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(tick);
  return { top, ticks };
}

/**
 * A small bar chart of 6–12 monthly values, oldest first. Bars follow the
 * page direction, so time runs right to left in Arabic.
 *
 * The plot is hidden from screen readers; a visually hidden table carries
 * every value. The latest month's value is printed on its bar, the others
 * show on hover. Nothing animates, so reduce motion has nothing to stop.
 */
export function MonthlyChart({
  title,
  description,
  data,
  locale,
  valueFormat,
  monthHeader,
  valueHeader,
  emptyLabel,
  className,
}: {
  title: string;
  description?: string;
  data: MonthlyValue[];
  /** Formats the values and ticks, e.g. "ar" or "en". */
  locale: string;
  /** Options for Intl.NumberFormat, e.g. one decimal for averages. */
  valueFormat?: Intl.NumberFormatOptions;
  /** Column headers of the screen-reader table. */
  monthHeader: string;
  valueHeader: string;
  /** Shown when there are no months to plot. */
  emptyLabel: string;
  className?: string;
}) {
  const format = new Intl.NumberFormat(locale, valueFormat);
  const max = Math.max(0, ...data.map((point) => point.value));
  const wholeNumbers = data.every((point) => Number.isInteger(point.value));
  const { top, ticks } = niceScale(max, wholeNumbers);
  const tickFormat = new Intl.NumberFormat(locale, {
    ...valueFormat,
    notation: top >= 10_000 ? "compact" : "standard",
  });
  const percent = (value: number) => `${(Math.max(0, value) / top) * 100}%`;
  // Arabic month names are long: on phones, label every other month, always
  // keeping the latest one.
  const thinLabels = data.length > 6;

  return (
    <figure className={cx("min-w-0 rounded-lg border border-text/10 bg-surface p-5 text-text shadow-sm", className)}>
      <figcaption className="mb-4">
        <span className="block text-base font-semibold text-pretty">{title}</span>
        {description && <span className="mt-1 block text-sm text-pretty text-text-secondary">{description}</span>}
      </figcaption>

      {data.length === 0 ? (
        <p className="flex h-44 items-center justify-center rounded-md border border-dashed border-text/20 px-4 text-center text-sm text-pretty text-text-secondary">
          {emptyLabel}
        </p>
      ) : (
        <>
          <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
            {/* Ticks, on the start side. */}
            <div className="relative h-44 min-w-6 text-xs text-text-secondary tabular-nums">
              {ticks.map((tick) => (
                <span key={tick} className="absolute end-0 block translate-y-1/2 leading-none whitespace-nowrap" style={{ bottom: percent(tick) }}>
                  {tickFormat.format(tick)}
                </span>
              ))}
              {/* Keeps the column as wide as its widest tick. */}
              <span className="invisible block h-0 overflow-hidden whitespace-nowrap">{tickFormat.format(top)}</span>
            </div>

            <div className="relative h-44">
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className={cx("absolute inset-x-0 border-t", tick === 0 ? "border-text/30" : "border-text/10")}
                  style={{ bottom: percent(tick) }}
                />
              ))}
              <ol className="relative flex h-full items-end gap-1">
                {data.map((point, index) => {
                  const latest = index === data.length - 1;
                  return (
                    <li key={index} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                      <span
                        className="block w-full max-w-6 rounded-t-[4px] bg-primary group-hover:opacity-80 motion-safe:transition-opacity dark:bg-accent"
                        style={{ height: percent(point.value) }}
                      />
                      <span
                        className={cx(
                          "absolute inset-x-0 flex justify-center text-xs font-semibold whitespace-nowrap",
                          latest ? "" : "invisible group-hover:visible",
                        )}
                        style={{ bottom: `calc(${percent(point.value)} + 4px)` }}
                      >
                        {format.format(point.value)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <span />
            <ol className="mt-2 flex gap-1 text-xs text-text-secondary">
              {data.map((point, index) => (
                <li
                  key={index}
                  className={cx(
                    "flex min-w-0 flex-1 justify-center whitespace-nowrap",
                    thinLabels && (data.length - 1 - index) % 2 === 1 && "max-sm:invisible",
                  )}
                >
                  {point.label}
                </li>
              ))}
            </ol>
          </div>

          <table className="sr-only">
            <thead>
              <tr>
                <th scope="col">{monthHeader}</th>
                <th scope="col">{valueHeader}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point, index) => (
                <tr key={index}>
                  <th scope="row">{point.label}</th>
                  <td>{format.format(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
