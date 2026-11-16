import type messages from "./Blog.json";

declare global {
  interface MessageNamespaces {
    Blog: typeof messages;
  }
}
