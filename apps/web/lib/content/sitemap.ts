import "server-only";
import {
  contentCacheTag,
  COURSES_CACHE_TAG,
  type ContentType,
  type Locale,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { courseLocales } from "./courses";
import { publicLocales, rowsOrThrow, text } from "./rows";

/**
 * What the sitemap lists (§6.24): published detail items, each with the
 * languages it's really public in and its path in each. Reads only through
 * here: explicit columns, published rows, nothing hidden or in draft.
 */
export type SitemapItem = {
  /** Path without the locale, per language it's public in. */
  paths: Partial<Record<Locale, string>>;
  /** UTC, from `updated_at`. */
  lastModified: string | null;
};

/** The single-language pages the sitemap must not list in a missing language. */
export type SitemapPage = { key: string; locales: Locale[]; lastModified: string | null };

type Row = Record<string, unknown> & { updated_at?: string | null; status: string };

const slugPath = (section: string, slug: string) => `/${section}/${encodeURIComponent(slug)}`;

function sameSlug(section: string, type: ContentType, row: Row & { slug: string }): SitemapItem | null {
  const locales = publicLocales(type, row);
  if (locales.length === 0) return null;
  const path = slugPath(section, row.slug);
  return {
    paths: Object.fromEntries(locales.map((locale) => [locale, path])),
    lastModified: row.updated_at ?? null,
  };
}


/** Every published detail item, per type. Cached by every content tag it reads. */
export async function getSitemapItems(): Promise<SitemapItem[]> {
  "use cache";
  cacheTag(
    contentCacheTag("services"),
    contentCacheTag("projects"),
    contentCacheTag("expertise_areas"),
    contentCacheTag("posts"),
    COURSES_CACHE_TAG,
  );
  cacheLife("hours");

  const db = createServiceClient();
  const [services, projects, areas, posts, courses] = await Promise.all([
    db
      .from("services")
      .select("slug, title_ar, title_en, summary_ar, summary_en, status, updated_at")
      .eq("status", "published")
      .then((result) => rowsOrThrow<Row & { slug: string }>(result, "services")),
    db
      .from("projects")
      .select(
        "slug, title_ar, title_en, goal_ar, goal_en, hide_org_name, org_label_ar, org_label_en, status, updated_at",
      )
      .eq("status", "published")
      .then((result) => rowsOrThrow<Row & { slug: string }>(result, "projects")),
    db
      .from("expertise_areas")
      .select("slug, title_ar, title_en, summary_ar, summary_en, status, updated_at")
      .eq("status", "published")
      .then((result) => rowsOrThrow<Row & { slug: string }>(result, "expertise_areas")),
    db
      .from("posts")
      .select("slug_ar, slug_en, title_ar, title_en, body_ar, body_en, status, updated_at")
      .eq("status", "published")
      .then((result) => rowsOrThrow<Row>(result, "posts")),
    db
      .from("courses")
      .select("slug, type, title_ar, title_en, description_ar, description_en, status, updated_at")
      .eq("status", "published")
      .then((result) => rowsOrThrow<Row & { slug: string }>(result, "courses")),
  ]);

  const items: (SitemapItem | null)[] = [
    ...services.map((row) => sameSlug("services", "services", row)),
    ...projects.map((row) => sameSlug("projects", "projects", row)),
    ...areas.map((row) => sameSlug("expertise", "expertise_areas", row)),
    // A post has its own slug in each language.
    ...posts.map((row): SitemapItem | null => {
      const paths: Partial<Record<Locale, string>> = {};
      for (const locale of publicLocales("posts", row)) {
        const slug = text(row, "slug", locale);
        if (slug) paths[locale] = slugPath("blog", slug);
      }
      return Object.keys(paths).length ? { paths, lastModified: row.updated_at ?? null } : null;
    }),
    ...courses.map((row): SitemapItem | null => {
      const locales = courseLocales(row);
      if (locales.length === 0) return null;
      const path = slugPath("training", row.slug);
      return {
        paths: Object.fromEntries(locales.map((locale) => [locale, path])),
        lastModified: row.updated_at ?? null,
      };
    }),
  ];
  return items.filter((item): item is SitemapItem => item !== null);
}

/** About, privacy and terms: the languages each is published in. */
export async function getSitemapPages(): Promise<SitemapPage[]> {
  "use cache";
  cacheTag(contentCacheTag("pages"));
  cacheLife("hours");

  const rows = rowsOrThrow<Row & { key: string }>(
    await createServiceClient()
      .from("pages")
      .select("key, title_ar, title_en, body_ar, body_en, status, updated_at")
      .eq("status", "published"),
    "pages",
  );
  return rows.map((row) => ({
    key: row.key,
    locales: publicLocales("pages", row),
    lastModified: row.updated_at ?? null,
  }));
}
