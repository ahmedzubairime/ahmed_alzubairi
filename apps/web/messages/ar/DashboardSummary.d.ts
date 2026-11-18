import type messages from "./DashboardSummary.json";

declare global {
  interface MessageNamespaces {
    DashboardSummary: typeof messages;
  }
}
