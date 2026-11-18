"use client";

import { useTranslations } from "next-intl";
import { requestClerk, useAuthState } from "@/components/clerk/auth-state";
import { cx, FOCUS_RING } from "@/components/ui/cx";
import { Link } from "@/i18n/navigation";

const CLASSES =
  "inline-flex h-9 items-center rounded-md px-2 text-sm font-semibold whitespace-nowrap";

/**
 * Sign-in or account. Clerk loads after the page (§13 Performance), so it
 * shows the signed-out link first: always safe, as the sign-in page sends a
 * signed-in visitor on. Pointing at it or focusing it loads Clerk at once.
 */
export function AuthLink() {
  const t = useTranslations("Header");
  const { isLoaded, isSignedIn } = useAuthState();
  const signedIn = isLoaded && isSignedIn;

  return (
    <Link
      href={signedIn ? "/account" : "/sign-in"}
      onPointerEnter={requestClerk}
      onFocus={requestClerk}
      className={cx(CLASSES, "hover:bg-text/10", FOCUS_RING)}
    >
      {signedIn ? t("account") : t("signIn")}
    </Link>
  );
}
