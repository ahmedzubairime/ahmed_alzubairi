"use client";

import { useState, useSyncExternalStore } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { CONSENT_EVENT, CONSENT_KEY, readConsent, writeConsent, type Consent } from "@/lib/analytics/consent";

/** On the server and while hydrating, the choice isn't known yet. */
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
 * Runs as the page is parsed, right after the banner's markup and before the
 * first paint: a visitor who already chose never sees it, not even for a
 * frame. A constant, never stored content. Storage can be blocked: the banner
 * then stays, as it does after hydration.
 */
export const HIDE_IF_CHOSEN = `try{var v=localStorage.getItem(${JSON.stringify(CONSENT_KEY)});if(v==="granted"||v==="denied")document.currentScript.previousElementSibling.hidden=true}catch(e){}`;

/**
 * Shows DaVinci's cookie banner (§6.25) until the visitor chooses, and saves
 * the choice for the analytics provider.
 *
 * The banner is in the server HTML (§13 Performance): it paints with the page
 * instead of after the scripts hydrate, which on a slow phone is seconds
 * later. The inline script hides it at once for a visitor who already chose;
 * after hydration the stored choice decides, as before.
 */
const noSubscription = () => () => {};

export function ConsentChoice() {
  // True in the server HTML and while hydrating it, false in a client render
  // (a language switch remounts the layout): React never runs a script it
  // creates on the client, so it isn't rendered there at all.
  const fromServer = useSyncExternalStore(noSubscription, () => false, () => true);
  const stored = useSyncExternalStore<Consent | null | typeof UNKNOWN>(subscribe, () => readConsent(), () => UNKNOWN);
  const [chosen, setChosen] = useState(false);
  const open = stored !== "granted" && stored !== "denied" && !chosen;
  const choose = (consent: Consent) => {
    setChosen(true);
    writeConsent(consent);
  };
  return (
    <>
      {/*
        A box-less wrapper: the banner itself is fixed. The script may hide it
        before hydration; whenever the banner is open, React shows it again.
      */}
      <div data-consent-banner="" hidden={open ? false : undefined} suppressHydrationWarning>
        <ConsentBanner
          open={open}
          onAccept={() => choose("granted")}
          onDecline={() => choose("denied")}
          privacyHref="/privacy"
        />
      </div>
      {fromServer && <script dangerouslySetInnerHTML={{ __html: HIDE_IF_CHOSEN }} suppressHydrationWarning />}
    </>
  );
}
