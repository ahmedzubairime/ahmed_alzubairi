import "server-only";
import { contentCacheTag, type Locale, type TiptapDoc } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicLocales, publicMediaUrl, richText, rowsOrThrow, text } from "./rows";
import type { Availability, Post } from "./types";

/**
 * Blog reads (§6.8). An article is public in a language only when it's
 * published and that language's slug, title and body are filled, so a
 * single-language article appears only in its language. Each language has its
 * own slug (`slug_ar`, `slug_en`).
 */

/** The expertise area a post or resource is filed under, when it's public in this language. */
export type ExpertiseRef = { slug: string; title: string };

export type PostListItem = Post & { expertiseId: string | null; expertise: ExpertiseRef | null };

export type PostDetail = PostListItem &
  Availability & {
    body: TiptapDoc;
    /** The article's slug in each language it's public in, for the language switch. */
    slugs: Partial<Record<Locale, string>>;
  };

export type PostQuery = {
  /** Matches the title or the excerpt. Blank means no search. */
  q?: string;
  /** An expertise area's slug. */
  expertise?: string;
  /** 1-based. Out-of-range pages are clamped. */
  page?: number;
  pageSize?: number;
};

export type PostPage = {
  posts: PostListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export const POSTS_PAGE_SIZE = 9;
export const RELATED_POSTS_LIMIT = 3;

const COLUMNS =
  "id, slug_ar, slug_en, expertise_id, title_ar, title_en, excerpt_ar, excerpt_en, body_ar, body_en, cover_path, reading_minutes_ar, reading_minutes_en, published_at, created_at, status, expertise_areas (slug, title_ar, title_en, status)";

type ExpertiseEmbed = {
  slug: string;
  title_ar: string | null;
  title_en: string | null;
  status: string;
} | null;

type PostRow = Record<string, unknown> & {
  id: string;
  expertise_id: string | null;
  cover_path: string | null;
  reading_minutes_ar: number | null;
  reading_minutes_en: number | null;
  published_at: string | null;
  created_at: string | null;
  status: string;
  expertise_areas: ExpertiseEmbed;
};

/** A published area with a title in this language, or null. Shared with `resources.ts`. */
export function toExpertiseRef(area: ExpertiseEmbed | undefined, locale: Locale): ExpertiseRef | null {
  if (!area || area.status !== "published") return null;
  const title = text(area, "title", locale);
  return title ? { slug: area.slug, title } : null;
}

/** Newest first: `published_at`, then `created_at`; undated last. */
function newestFirst(a: PostRow, b: PostRow) {
  const time = (row: PostRow) => Date.parse(row.published_at ?? row.created_at ?? "") || 0;
  return time(b) - time(a);
}

function toPost(row: PostRow, locale: Locale): PostListItem | null {
  const slug = text(row, "slug", locale);
  const title = text(row, "title", locale);
  if (!isPublicIn("posts", row, locale) || !slug || !title) return null;
  return {
    id: row.id,
    slug,
    title,
    excerpt: text(row, "excerpt", locale),
    coverUrl: publicMediaUrl(row.cover_path),
    readingMinutes: locale === "ar" ? row.reading_minutes_ar : row.reading_minutes_en,
    publishedAt: row.published_at,
    expertiseId: row.expertise_id,
    expertise: toExpertiseRef(row.expertise_areas, locale),
  };
}

/** Every public post in this language, newest first. One cache entry per language. */
async function publicPosts(locale: Locale): Promise<PostListItem[]> {
  "use cache";
  cacheTag(contentCacheTag("posts"), contentCacheTag("expertise_areas"));
  cacheLife("hours");

  const rows = rowsOrThrow<PostRow>(
    await createServiceClient()
      .from("posts")
      .select(COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false }),
    "posts",
  );
  return [...rows].sort(newestFirst).flatMap((row) => toPost(row, locale) ?? []);
}

/**
 * Folds case, Arabic diacritics and tatweel, and the alef, yaa and taa
 * marbuta variants, so "الإدارة" finds "الادارة".
 */
function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function matches(post: PostListItem, q: string) {
  return [post.title, post.excerpt ?? ""].some((field) => normalize(field).includes(q));
}

/** One page of public posts in this language, searched and filtered (§6.8). */
export async function getPosts(locale: Locale, query: PostQuery = {}): Promise<PostPage> {
  const q = normalize(query.q?.trim() ?? "");
  const filtered = (await publicPosts(locale)).filter(
    (post) =>
      (!query.expertise || post.expertise?.slug === query.expertise) && (!q || matches(post, q)),
  );

  // A page size that isn't a number (NaN from a bad query string) falls back.
  const pageSize = Math.max(1, Math.floor(query.pageSize ?? POSTS_PAGE_SIZE) || POSTS_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Math.floor(query.page ?? 1) || 1), pageCount);
  return {
    posts: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount,
  };
}

/** One post by its slug in this language, or null when it isn't public in it. */
export async function getPost(slug: string, locale: Locale): Promise<PostDetail | null> {
  "use cache";
  cacheTag(contentCacheTag("posts"), contentCacheTag("expertise_areas"));
  cacheLife("hours");

  const row = rowsOrThrow<PostRow>(
    await createServiceClient()
      .from("posts")
      .select(COLUMNS)
      .eq(`slug_${locale}`, slug)
      .eq("status", "published")
      .limit(1),
    "posts",
  ).find((item) => text(item, "slug", locale) === slug);
  if (!row) return null;
  const post = toPost(row, locale);
  const body = richText(row, "body", locale);
  if (!post || !body) return null;

  const availableIn = publicLocales("posts", row);
  const slugs: Partial<Record<Locale, string>> = {};
  for (const other of availableIn) {
    const value = text(row, "slug", other);
    if (value) slugs[other] = value;
  }
  return { ...post, body, availableIn, slugs };
}

/**
 * Up to three other public posts in this language from the same expertise
 * area, newest first. None when the post has no area.
 */
export async function getRelatedPosts(
  post: { id: string; expertiseId: string | null },
  locale: Locale,
): Promise<PostListItem[]> {
  if (!post.expertiseId) return [];
  return (await publicPosts(locale))
    .filter((other) => other.id !== post.id && other.expertiseId === post.expertiseId)
    .slice(0, RELATED_POSTS_LIMIT);
}

/**
 * True when `getPost` would return this slug in this language. Not cached, so
 * the proxy can call it: a `"use cache"` function throws there. It reads one
 * row and only the columns the rule needs.
 * A given `signal` cancels the query, and the call then throws.
 */
export async function hasPost(slug: string, locale: Locale, signal?: AbortSignal): Promise<boolean> {
  const query = createServiceClient()
    .from("posts")
    .select(`slug_${locale}, status, title_${locale}, body_${locale}`)
    .eq(`slug_${locale}`, slug)
    .eq("status", "published")
    .limit(1);
  const rows = rowsOrThrow<Record<string, unknown>>(
    await (signal ? query.abortSignal(signal) : query),
    "posts",
  );
  return rows.some((row) => text(row, "slug", locale) === slug && isPublicIn("posts", row, locale));
}
