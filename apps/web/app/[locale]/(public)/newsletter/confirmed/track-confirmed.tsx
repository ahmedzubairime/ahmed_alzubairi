"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";

/**
 * Sends `newsletter_confirmed` once. The page mounts it only on the confirm
 * route's success redirect (`?status=confirmed`); it then removes the param,
 * so a reload or a bookmark of the page never counts again. Renders nothing.
 */
export function TrackConfirmed() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("newsletter_confirmed");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("status");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // The event is sent; the param only stays in the address bar.
    }
  }, []);
  return null;
}
