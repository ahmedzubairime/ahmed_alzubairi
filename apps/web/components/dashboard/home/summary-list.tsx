import { getTranslations } from "next-intl/server";
import { StatTile } from "@/components/ui";
import type { SummaryItem } from "./summary";

/**
 * The dashboard home's numbers (§6.20), as stat tiles like the statistics
 * page. Each tile links to its section; its label and number make the link's
 * name. Nothing shows when no count came back.
 */
export async function SummaryList({ items }: { items: readonly SummaryItem[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations("DashboardSummary");
  const label = (item: SummaryItem) =>
    item.scope === "assigned" && (item.key === "newRequests" || item.key === "activeConsultations")
      ? t(`assigned.${item.key}`)
      : t(`items.${item.key}`, { days: item.days ?? 0 });

  return (
    <section aria-labelledby="dashboard-summary" className="space-y-3">
      <h2 id="dashboard-summary" className="text-lg text-text">
        {t("heading")}
      </h2>
      {/* Two columns even on phones: six short tiles, half the scrolling. */}
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <StatTile href={item.href} label={label(item)} value={t("number", { count: item.count })} />
          </li>
        ))}
      </ul>
    </section>
  );
}
