"use client";

import { useLocale } from "next-intl";
import { useInBrowser } from "@/components/workspace/use-in-browser";

/**
 * A date and time in the viewer's locale and time zone. The server doesn't
 * know the zone, so the text is filled in by the browser.
 */
export function LocalTime({ value }: { value: string }) {
  const locale = useLocale();
  const inBrowser = useInBrowser();
  return (
    <time dateTime={value}>
      {inBrowser &&
        new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))}
    </time>
  );
}
