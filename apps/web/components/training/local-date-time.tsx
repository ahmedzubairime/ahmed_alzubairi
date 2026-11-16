"use client";

import { useLocale } from "next-intl";
import { useInBrowser } from "@/components/workspace/use-in-browser";

/**
 * A course's start in the viewer's language and time zone, with the zone
 * named (§6.7). The server doesn't know the zone, so it sends `fallback` (the
 * date in UTC) and the browser replaces it with the local date and time.
 */
export function LocalDateTime({ value, fallback }: { value: string; fallback: string }) {
  const locale = useLocale();
  const inBrowser = useInBrowser();
  return (
    <time dateTime={value}>
      {inBrowser
        ? // Named parts, not `dateStyle`: a style can't be combined with a zone name.
          new Intl.DateTimeFormat(locale, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          }).format(new Date(value))
        : fallback}
    </time>
  );
}
