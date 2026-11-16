import type messages from "./DashboardNewsletter.json";

declare global {
  interface MessageNamespaces {
    DashboardNewsletter: typeof messages;
  }
}
