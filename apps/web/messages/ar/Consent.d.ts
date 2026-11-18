import type messages from "./Consent.json";

declare global {
  interface MessageNamespaces {
    Consent: typeof messages;
  }
}
