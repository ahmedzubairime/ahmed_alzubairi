import type messages from "./DashboardStatistics.json";

declare global {
  interface MessageNamespaces {
    DashboardStatistics: typeof messages;
  }
}
