import "server-only";
import { contentCacheTag, mediaCategorySchema, type Locale, type MediaCategory } from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { isPublicIn, publicMediaUrl, rowsOrThrow, text } from "./rows";
import type { MediaItem } from "./types";

/** Media and events reads (§6.10). */

export type MediaQuery = { category?: MediaCategory };

const COLUMNS =
  "id, category, title_ar, title_en, outlet_ar, outlet_en, date, image_path, url, video_url, status, created_at";

type MediaRow = Record<string, unknown> & {
  id: string;
  category: string;
  date: string | null;
  image_path: string | null;
  url: string | null;
  video_url: string | null;
  created_at: string | null;
  status: string;
};

/** Newest first by `date`, then `created_at`; undated last. */
function newestFirst(a: MediaRow, b: MediaRow) {
  const time = (row: MediaRow) => Date.parse(row.date ?? row.created_at ?? "") || 0;
  return time(b) - time(a);
}

function toMediaItem(row: MediaRow, locale: Locale): MediaItem | null {
  const title = text(row, "title", locale);
  const category = mediaCategorySchema.safeParse(row.category);
  if (!isPublicIn("media_items", row, locale) || !title || !category.success) return null;
  return {
    id: row.id,
    category: category.data,
    title,
    outlet: text(row, "outlet", locale),
    date: row.date,
    imageUrl: publicMediaUrl(row.image_path),
    url: row.url,
    videoUrl: row.video_url,
  };
}

/** Every public media item in this language, newest first. One cache entry per language. */
async function publicMediaItems(locale: Locale): Promise<MediaItem[]> {
  "use cache";
  cacheTag(contentCacheTag("media_items"));
  cacheLife("hours");

  const rows = rowsOrThrow<MediaRow>(
    await createServiceClient()
      .from("media_items")
      .select(COLUMNS)
      .eq("status", "published")
      .order("date", { ascending: false, nullsFirst: false }),
    "media_items",
  );
  return [...rows].sort(newestFirst).flatMap((row) => toMediaItem(row, locale) ?? []);
}

/** Public media items in this language, newest first, optionally one category (§6.10). */
export async function getMediaItems(locale: Locale, query: MediaQuery = {}): Promise<MediaItem[]> {
  return (await publicMediaItems(locale)).filter(
    (item) => !query.category || item.category === query.category,
  );
}
