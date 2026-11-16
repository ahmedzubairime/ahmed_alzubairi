import type messages from "./Training.json";

declare global {
  interface MessageNamespaces {
    Training: typeof messages;
  }
}
