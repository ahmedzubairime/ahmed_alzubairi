/**
 * The visitor's cookie choice (§6.25), kept in localStorage under `consent`.
 * Read only in the browser after mount. Storage can be blocked (private mode,
 * blocked site data), so every access is guarded: no choice is the answer.
 */
export const CONSENT_KEY = "consent";
export const CONSENT_EVENT = "analytics:consent";

export type Consent = "granted" | "denied";

export function readConsent(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Consent | null {
  try {
    const value = storage?.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

/** Saves the choice (when storage allows) and tells the analytics provider. */
export function writeConsent(consent: Consent, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(CONSENT_KEY, consent);
  } catch {
    // The choice still applies to this page view.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Consent>(CONSENT_EVENT, { detail: consent }));
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
