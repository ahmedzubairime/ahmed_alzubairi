"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";

/**
 * Sends `newsletter_confirmed` once per page load. The page mounts it only
 * when the confirm route said the address is confirmed. Renders nothing.
 */
export function TrackConfirmed() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("newsletter_confirmed");
  }, []);
  return null;
}
