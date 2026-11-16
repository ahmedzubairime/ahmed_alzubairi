import type messages from "./Resources.json";

declare global {
  interface MessageNamespaces {
    Resources: typeof messages;
  }
}
