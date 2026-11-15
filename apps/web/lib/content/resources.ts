import "server-only";
import {
  contentCacheTag,
  resourceAccessSchema,
  resourceKindSchema,
  type Locale,
  type ResourceKind,
} from "@repo/shared";
import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { toExpertiseRef, type ExpertiseRef } from "./posts";
import { isPublicIn, rowsOrThrow, text } from "./rows";
import type { Resource } from "./types";

/**
 * Free resources reads (§6.9). `storage_key` is never selected: the file goes
 * out only by signed URL, through the download route.
 */

export type ResourceListItem = Resource & { expertise: ExpertiseRef | null };

export type ResourceQuery = {
  /** An expertise area's slug. */
  expertise?: string;
  kind?: ResourceKind;
};

const COLUMNS =
  "id, expertise_id, kind, title_ar, title_en, description_ar, description_en, access, status, created_at, expertise_areas (slug, title_ar, title_en, status)";

type ResourceRow = Record<string, unknown> & {
  id: string;
  kind: string;
  access: string;
  status: string;
  expertise_areas: { slug: string; title_ar: string | null; title_en: string | null; status: string } | null;
};

function toResource(row: ResourceRow, locale: Locale): ResourceListItem | null {
  const title = text(row, "title", locale);
  const kind = resourceKindSchema.safeParse(row.kind);
  const access = resourceAccessSchema.safeParse(row.access);
  if (!isPublicIn("resources", row, locale) || !title || !kind.success || !access.success) return null;
  // Built field by field, so no other column can reach the page.
  return {
    id: row.id,
    kind: kind.data,
    title,
    description: text(row, "description", locale),
    access: access.data,
    expertise: toExpertiseRef(row.expertise_areas, locale),
  };
}

/** Every public resource in this language, newest first. One cache entry per language. */
async function publicResources(locale: Locale): Promise<ResourceListItem[]> {
  "use cache";
  cacheTag(contentCacheTag("resources"), contentCacheTag("expertise_areas"));
  cacheLife("hours");

  const rows = rowsOrThrow<ResourceRow>(
    await createServiceClient()
      .from("resources")
      .select(COLUMNS)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    "resources",
  );
  return rows.flatMap((row) => toResource(row, locale) ?? []);
}

/** Public resources in this language, filtered by expertise area and kind (§6.9). */
export async function getResources(
  locale: Locale,
  query: ResourceQuery = {},
): Promise<ResourceListItem[]> {
  return (await publicResources(locale)).filter(
    (resource) =>
      (!query.expertise || resource.expertise?.slug === query.expertise) &&
      (!query.kind || resource.kind === query.kind),
  );
}
