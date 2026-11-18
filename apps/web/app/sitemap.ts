import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemapItems, getSitemapPages } from "@/lib/content/sitemap";
import { buildSitemap } from "@/lib/seo";

/**
 * `sitemap.xml` (§6.24). Rendered on request, never at build: the build has no
 * Supabase. The reads are cached by the content tags, so publishing refreshes it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [pages, items] = await Promise.all([getSitemapPages(), getSitemapItems()]);
  return buildSitemap({ pages, items });
}
