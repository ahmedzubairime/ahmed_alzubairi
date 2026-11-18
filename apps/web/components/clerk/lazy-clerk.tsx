"use client";

import { useLocale } from "next-intl";
import { lazy, Suspense, useEffect, useState } from "react";
import { signInPath, signUpPath } from "@/lib/auth/return-path";
import { onClerkRequest } from "./auth-state";

const PublicClerk = lazy(() => import("./public-clerk"));

/** The interactions that load Clerk at once: the visitor is using the page. */
export const FIRST_INTERACTION = ["pointerdown", "keydown", "touchstart"] as const;

/** Idle may never come on a busy page: load by then at the latest. */
export const IDLE_TIMEOUT_MS = 5000;

/**
 * Loads Clerk on public pages only once the page is idle, on the first
 * interaction, or when an auth-aware control asks for it (§13 Performance):
 * its scripts and the provider's own code then stay off the first paint.
 *
 * It sits beside the page, not around it, so loading Clerk never re-renders
 * or remounts the page. Public layouts still never read the session on the
 * server.
 */
export function LazyClerk() {
  const locale = useLocale();
  const [load, setLoad] = useState(false);

  useEffect(() => {
    if (load) return;
    const start = () => setLoad(true);
    const stopRequests = onClerkRequest(start);
    for (const type of FIRST_INTERACTION) window.addEventListener(type, start, { once: true, passive: true });
    const idle =
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(start, { timeout: IDLE_TIMEOUT_MS })
        : window.setTimeout(start, IDLE_TIMEOUT_MS);
    return () => {
      stopRequests();
      for (const type of FIRST_INTERACTION) window.removeEventListener(type, start);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [load]);

  if (!load) return null;
  return (
    <Suspense fallback={null}>
      <PublicClerk
        signInUrl={signInPath(locale)}
        signUpUrl={signUpPath(locale)}
        afterSignOutUrl={`/${locale}`}
      />
    </Suspense>
  );
}
