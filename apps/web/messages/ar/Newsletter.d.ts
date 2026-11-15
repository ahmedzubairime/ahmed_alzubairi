import type messages from "./Newsletter.json";

declare global {
  interface MessageNamespaces {
    Newsletter: typeof messages;
  }
}
