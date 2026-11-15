import type messages from "./PublicListing.json";

declare global {
  interface MessageNamespaces {
    PublicListing: typeof messages;
  }
}
