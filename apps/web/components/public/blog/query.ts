import type { ListingQuery } from "../listing";

/**
 * The blog list's query (§6.8), kept in the URL so a search can be shared and
 * the language switch keeps it. An expertise slug is the same in both languages.
 */
export const BLOG_PATH = "/blog";
export const SEARCH_PARAM = "q";
export const CATEGORY_PARAM = "category";
export const PAGE_PARAM = "page";

/** Longer searches are cut: a search is a few words, never a document. */
export const MAX_SEARCH_LENGTH = 100;

export type BlogQuery = { q: string | null; category: string | null; page: number };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const item = (Array.isArray(value) ? value[0] : value)?.trim();
  return item ? item : null;
}

/** Reads the query. A page that isn't a positive whole number means page 1. */
export function parseBlogQuery(params: SearchParams): BlogQuery {
  const page = Number(first(params[PAGE_PARAM]));
  return {
    q: first(params[SEARCH_PARAM])?.slice(0, MAX_SEARCH_LENGTH) ?? null,
    category: first(params[CATEGORY_PARAM]),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

/** The query as the listing components take it: no page, no empty value. */
export function listingQuery(query: BlogQuery): ListingQuery {
  return {
    ...(query.q ? { [SEARCH_PARAM]: query.q } : {}),
    ...(query.category ? { [CATEGORY_PARAM]: query.category } : {}),
  };
}

/** An article's path, without the locale. Arabic slugs are percent-encoded. */
export function articlePath(slug: string): string {
  return `${BLOG_PATH}/${encodeURIComponent(slug)}`;
}

/**
 * The full canonical URL of a path in a language, for sharing and metadata.
 * `base` is the site's address (`NEXT_PUBLIC_APP_URL`); null when it's
 * missing or not a web address.
 */
export function canonicalUrl(base: string | undefined, locale: string, path: string): string | null {
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return `${url.origin}/${locale}${path}`;
  } catch {
    return null;
  }
}
