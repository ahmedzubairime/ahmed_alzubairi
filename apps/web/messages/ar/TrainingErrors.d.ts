import type messages from "./TrainingErrors.json";

declare global {
  interface MessageNamespaces {
    TrainingErrors: typeof messages;
  }
}
