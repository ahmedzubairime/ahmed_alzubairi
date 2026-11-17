import { RESOURCE_KINDS } from "@repo/shared";
import { useTranslations } from "next-intl";
import { cx } from "@/components/ui/cx";
import type { ExpertiseArea } from "@/lib/content";
import type { ResourceListItem } from "@/lib/content/resources";
import { FilterChips, ResourceCard } from "../listing";
import { CONTAINER, EmptyNote, MoreLink } from "../parts";
import { AREA_PARAM, KIND_PARAM, listingQuery, RESOURCES_PATH, type ResourcesQuery } from "./query";
import { ResourceDownload } from "./resource-download";

/**
 * `/resources` under its hero: the expertise and type chips, then the
 * resource cards (§6.9). `resources` holds only what's public in this
 * language. The file itself is reached only through the download route.
 */
export function ResourcesList({
  resources,
  areas,
  query,
}: {
  resources: ResourceListItem[];
  /** Expertise areas published in this language. */
  areas: ExpertiseArea[];
  query: ResourcesQuery;
}) {
  const t = useTranslations("Resources");
  const listing = useTranslations("PublicListing");
  const kept = listingQuery(query);
  const filtered = query.area !== null || query.kind !== null;

  return (
    <div className={cx(CONTAINER, "py-12 md:py-16")}>
      <div className="grid gap-6">
        {areas.length > 0 && (
          <FilterChips
            label={t("areaLabel")}
            pathname={RESOURCES_PATH}
            param={AREA_PARAM}
            options={areas.map((area) => ({ value: area.slug, label: area.title }))}
            query={kept}
          />
        )}
        <FilterChips
          label={t("kindLabel")}
          pathname={RESOURCES_PATH}
          param={KIND_PARAM}
          options={RESOURCE_KINDS.map((kind) => ({ value: kind, label: listing(`resourceKind.${kind}`) }))}
          query={kept}
        />
      </div>

      {/* Announces the new count after a filter, zero included. */}
      <p role="status" className="mt-8 text-sm font-semibold text-text-secondary">
        {(resources.length > 0 || filtered) && t("resultsCount", { count: resources.length })}
      </p>

      {resources.length === 0 ? (
        <div className="mt-2 grid justify-items-start gap-4">
          <EmptyNote text={filtered ? t("noResults") : t("empty")} />
          {filtered && <MoreLink href={RESOURCES_PATH} label={t("clearFilters")} />}
        </div>
      ) : (
        <ul className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <li key={resource.id} className="flex">
              <ResourceCard
                kind={resource.kind}
                // The public read doesn't carry the file's format.
                fileType={null}
                title={resource.title}
                description={resource.description}
                action={<ResourceDownload id={resource.id} title={resource.title} access={resource.access} />}
                className="w-full"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
