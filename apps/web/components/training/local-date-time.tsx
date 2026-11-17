"use client";

import { useLocale } from "next-intl";
import { useInBrowser } from "@/components/workspace/use-in-browser";

// Named parts, not `dateStyle`: a style can't be combined with a zone name.
const DATE_TIME: Intl.DateTimeFormatOptions = {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
};
const DATE: Intl.DateTimeFormatOptions = { dateStyle: "long" };

/**
 * A moment in the viewer's language and time zone (§6.7): by default the date
 * and time with the zone named, or with `dateOnly` just the date. The server
 * doesn't know the zone, so it sends `fallback` (the date in UTC) and the
 * browser replaces it with the local value.
 */
export function LocalDateTime({
  value,
  fallback,
  dateOnly = false,
}: {
  value: string;
  fallback: string;
  dateOnly?: boolean;
}) {
  const locale = useLocale();
  const inBrowser = useInBrowser();
  return (
    <time dateTime={value}>
      {inBrowser ? new Intl.DateTimeFormat(locale, dateOnly ? DATE : DATE_TIME).format(new Date(value)) : fallback}
    </time>
  );
}
