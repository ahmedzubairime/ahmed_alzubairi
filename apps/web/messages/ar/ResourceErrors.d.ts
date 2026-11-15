import type messages from "./ResourceErrors.json";

declare global {
  interface MessageNamespaces {
    ResourceErrors: typeof messages;
  }
}
