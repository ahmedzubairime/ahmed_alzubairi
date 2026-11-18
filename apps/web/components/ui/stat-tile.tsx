import type { ReactNode } from "react";
import { cx } from "./cx";
import { Skeleton } from "./skeleton";

/**
 * `better` and `worse` say whether the change is good news, not which way the
 * number moved: fewer days to first reply is `better` with a down arrow.
 */
export type StatChangeTone = "better" | "worse" | "neutral";

export type StatChange = {
  /** Which way the number moved. Drives the arrow only. */
  direction: "up" | "down" | "flat";
  tone: StatChangeTone;
  /** The formatted change, e.g. "+12%". The caller formats it with Intl. */
  value: string;
  /** The period it compares with, e.g. "vs last month". Read with the value, so the color is never the only cue. */
  label: string;
};

export type StatTileState = "ready" | "loading" | "unavailable";

// Gold is never text (§13), and there is no green token: a good change reads
// in the main text color, a bad one in danger, a neutral one in secondary text.
const CHANGE_TONES: Record<StatChangeTone, string> = {
  better: "text-text",
  worse: "text-danger",
  neutral: "text-text-secondary",
};

function ChangeArrow({ direction }: { direction: StatChange["direction"] }) {
  // Up and down don't mirror in Arabic; flat is a dash, not an arrow.
  const path = direction === "up" ? "M12 19V5M6 11l6-6 6 6" : direction === "down" ? "M12 5v14M6 13l6 6 6-6" : "M5 12h14";
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * One KPI: a label, a big value, and optionally its unit, a hint and the
 * change since the previous period. The caller formats every number with
 * `Intl` in the user's locale.
 *
 * `loading` shows a skeleton. `unavailable` is for a KPI whose source failed:
 * the tile keeps its label and says so, instead of showing a wrong zero.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  change,
  state = "ready",
  loadingLabel,
  unavailableLabel,
  className,
}: {
  label: string;
  /** The formatted value, e.g. "1,284". Required when `state` is `ready`. */
  value?: string;
  /** Shown after the value in smaller text, e.g. "days". */
  unit?: string;
  /** A short line under the value, e.g. what the KPI counts. */
  hint?: ReactNode;
  change?: StatChange;
  state?: StatTileState;
  /** Read by screen readers while loading. Required with `loading`. */
  loadingLabel?: string;
  /** Shown in place of the value, e.g. "Not available right now". Required with `unavailable`. */
  unavailableLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("flex min-w-0 flex-col gap-2 rounded-lg border border-text/10 bg-surface p-5 text-text shadow-sm", className)}
      aria-busy={state === "loading" || undefined}
    >
      <p className="text-sm font-semibold text-pretty text-text-secondary">{label}</p>

      {state === "loading" && (
        <>
          {loadingLabel && (
            <span className="sr-only" role="status">
              {loadingLabel}
            </span>
          )}
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-36" />
        </>
      )}

      {state === "unavailable" && (
        <p className="flex items-center gap-2 text-base text-text-secondary">
          {/* A dash where the number would be, so the tile keeps its shape. */}
          <span aria-hidden="true" className="text-3xl leading-none font-semibold">
            —
          </span>
          <span>{unavailableLabel}</span>
        </p>
      )}

      {state === "ready" && (
        <>
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            {/* Proportional figures: tabular ones look loose at this size. */}
            <span className="text-3xl leading-tight font-semibold break-words md:text-4xl">{value}</span>
            {unit && <span className="text-base text-text-secondary">{unit}</span>}
          </p>
          {change && (
            <p className={cx("flex flex-wrap items-center gap-x-1.5 text-sm", CHANGE_TONES[change.tone])}>
              <ChangeArrow direction={change.direction} />
              {/* The value keeps its own direction, so "+12%" isn't reordered in Arabic. */}
              <bdi className="font-semibold">{change.value}</bdi>
              <span className="text-text-secondary">{change.label}</span>
            </p>
          )}
          {hint && <p className="text-sm text-pretty text-text-secondary">{hint}</p>}
        </>
      )}
    </div>
  );
}
