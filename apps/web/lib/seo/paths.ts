/**
 * The public static and listing pages, with their paths. The sitemap lists
 * the same set, so a page added here is also listed there.
 */
export const STATIC_PAGES = {
  home: "/",
  about: "/about",
  expertise: "/expertise",
  services: "/services",
  projects: "/projects",
  training: "/training",
  blog: "/blog",
  resources: "/resources",
  media: "/media",
  clients: "/clients",
  documents: "/documents",
  faq: "/faq",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export type StaticPageKey = Exclude<keyof typeof STATIC_PAGES, "home">;
