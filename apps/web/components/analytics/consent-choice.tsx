"use client";

import { useState, useSyncExternalStore } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { CONSENT_EVENT, readConsent, writeConsent, type Consent } from "@/lib/analytics/consent";

/** On the server and before hydration the choice is unknown: no banner. */
const UNKNOWN = "unknown";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Shows DaVinci's cookie banner (§6.25) until the visitor chooses, and saves
 * the choice for the analytics provider. The choice is read in the browser
 * only. When storage is blocked, the banner closes for this page once chosen.
 */
export function ConsentChoice() {
  const stored = useSyncExternalStore<Consent | null | typeof UNKNOWN>(subscribe, () => readConsent(), () => UNKNOWN);
  const [chosen, setChosen] = useState(false);
  const open = stored === null && !chosen;
  const choose = (consent: Consent) => {
    setChosen(true);
    writeConsent(consent);
  };
  return (
    <ConsentBanner
      open={open}
      onAccept={() => choose("granted")}
      onDecline={() => choose("denied")}
      privacyHref="/privacy"
    />
  );
}

