import { resourceKindSchema, type ResourceKind } from "@repo/shared";
import type { ListingQuery } from "../listing";

/**
 * The resources list's filters (§6.9), kept in the URL so a filtered list can
 * be shared and the language switch keeps it. An expertise slug is the same
 * in both languages.
 */
export const RESOURCES_PATH = "/resources";
export const AREA_PARAM = "area";
export const KIND_PARAM = "type";

export type ResourcesQuery = { area: string | null; kind: ResourceKind | null };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | null {
  const item = (Array.isArray(value) ? value[0] : value)?.trim();
  return item ? item : null;
}

/** Reads the filters. A resource type that doesn't exist means no type filter. */
export function parseResourcesQuery(params: SearchParams): ResourcesQuery {
  const kind = resourceKindSchema.safeParse(first(params[KIND_PARAM]));
  return { area: first(params[AREA_PARAM]), kind: kind.success ? kind.data : null };
}

/** The filters as the listing components take them: no empty value. */
export function listingQuery(query: ResourcesQuery): ListingQuery {
  return {
    ...(query.area ? { [AREA_PARAM]: query.area } : {}),
    ...(query.kind ? { [KIND_PARAM]: query.kind } : {}),
  };
}
