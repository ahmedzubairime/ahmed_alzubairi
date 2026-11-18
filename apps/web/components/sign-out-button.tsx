"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { cx } from "@/components/ui/cx";

/**
 * Sign out, for the account and the dashboard. Until Clerk has loaded (before
 * hydration, or just after a client navigation mounts a new provider), the
 * button is shown but marked disabled and ignores clicks, so a click is never
 * silently lost. Only the colour and cursor change, never the size.
 */
export function SignOutButton() {
  const t = useTranslations("Header");
  const clerk = useClerk();
  // Clerk's own button goes to "/", which is always Arabic: send the member
  // to their own language's home instead.
  const home = getPathname({ href: "/", locale: useLocale() });
  const ready = clerk.loaded;

  return (
    <button
      type="button"
      aria-disabled={ready ? undefined : "true"}
      onClick={() => {
        if (!ready) return;
        void clerk.signOut({ redirectUrl: home });
      }}
      className={cx(
        "inline-flex h-9 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap",
        ready ? "hover:bg-text/10" : "cursor-not-allowed opacity-50",
      )}
    >
      {t("signOut")}
    </button>
  );
}
