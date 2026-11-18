"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { FOCUS_RING, cx } from "@/components/ui/cx";

/**
 * The cookie banner's look. It holds no state: the caller decides when it is
 * open and what accepting or declining does.
 *
 * A labelled region, not a dialog: it doesn't trap focus or block the page.
 * Accept and decline have the same style and size, so declining is as easy
 * as accepting. On phones it stays short (one sentence, one row of buttons).
 *
 * It never hides content for good: while open, an in-flow spacer as tall as
 * the space the banner takes at the bottom of the screen ends the page, so
 * every button and field can scroll above it.
 */
export function ConsentBanner({
  open,
  onAccept,
  onDecline,
  privacyHref,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
  privacyHref: string;
}) {
  if (!open) return null;
  return <OpenBanner onAccept={onAccept} onDecline={onDecline} privacyHref={privacyHref} />;
}

/**
 * How much of the screen's bottom the banner covers: its height plus the gap
 * under it on wider screens. Measured again when its size changes (text
 * wrapping, a breakpoint, the language).
 */
function useCoveredHeight() {
  const ref = useRef<HTMLElement>(null);
  const [covered, setCovered] = useState(0);
  // Before paint, so the page never shows a frame without the spacer.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setCovered(Math.max(0, Math.ceil(window.innerHeight - element.getBoundingClientRect().top)));
    measure();
    // Old browsers without ResizeObserver still measure on window resize.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { ref, covered };
}

function OpenBanner({
  onAccept,
  onDecline,
  privacyHref,
}: {
  onAccept: () => void;
  onDecline: () => void;
  privacyHref: string;
}) {
  const t = useTranslations("Consent");
  const { ref, covered } = useCoveredHeight();

  return (
    <>
      {/* The page ends with the banner's height, so nothing stays under it. */}
      <div aria-hidden="true" data-consent-spacer="" className="shrink-0" style={{ height: covered }} />
      <section
        ref={ref}
        aria-label={t("label")}
        className={cx(
          "fixed inset-x-0 bottom-0 z-40 border-t border-text/10 bg-surface text-text shadow-lg",
          "sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:rounded-lg sm:border",
        )}
      >
        {/* Tighter on short screens, so it takes less of the view. */}
        <div className="flex flex-col gap-3 px-4 py-3 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-2 sm:flex-row sm:items-center sm:gap-6 sm:p-4">
          <p className="min-w-0 flex-1 text-sm text-pretty">
            {t("text")}{" "}
            <Link href={privacyHref} className={cx("font-semibold whitespace-nowrap underline underline-offset-4", FOCUS_RING)}>
              {t("privacy")}
            </Link>
          </p>
          {/* Same variant, same width: neither choice is the default. */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-64">
            <Button variant="secondary" onClick={onAccept}>
              {t("accept")}
            </Button>
            <Button variant="secondary" onClick={onDecline}>
              {t("decline")}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
