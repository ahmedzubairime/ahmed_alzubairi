import type messages from "./Analytics.json";

declare global {
  interface MessageNamespaces {
    Analytics: typeof messages;
  }
}
