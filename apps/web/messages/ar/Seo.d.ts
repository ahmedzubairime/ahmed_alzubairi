import type messages from "./Seo.json";

declare global {
  interface MessageNamespaces {
    Seo: typeof messages;
  }
}
