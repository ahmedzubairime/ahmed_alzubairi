import type messages from "./Media.json";

declare global {
  interface MessageNamespaces {
    Media: typeof messages;
  }
}
