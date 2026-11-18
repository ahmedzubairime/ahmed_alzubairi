"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui";
import { FOCUS_RING, cx } from "@/components/ui/cx";

/**
 * The cookie banner's look. It holds no state: the caller decides when it is
 * open and what accepting or declining does.
 *
 * A labelled region, not a dialog: it doesn't trap focus or block the page.
 * Accept and decline have the same style and size, so declining is as easy
 * as accepting. On phones it stays short (one sentence, one row of buttons)
 * so it never hides more than the bottom of the screen.
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
  const t = useTranslations("Consent");
  if (!open) return null;

  return (
    <section
      aria-label={t("label")}
      className={cx(
        "fixed inset-x-0 bottom-0 z-40 border-t border-text/10 bg-surface text-text shadow-lg",
        "sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:rounded-lg sm:border",
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:p-4">
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
  );
}
