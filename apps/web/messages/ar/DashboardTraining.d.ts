import type messages from "./DashboardTraining.json";

declare global {
  interface MessageNamespaces {
    DashboardTraining: typeof messages;
  }
}
