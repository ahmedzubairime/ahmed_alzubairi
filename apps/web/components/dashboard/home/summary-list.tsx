import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import type { SummaryItem } from "./summary";

/**
 * The dashboard home's numbers (§6.20). Each card links to its section; the
 * number and its label make the link's name. Nothing shows when no count
 * came back.
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
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card as="li" compact key={item.key} className="relative">
            <Link
              href={item.href}
              className="flex flex-col gap-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring after:absolute after:inset-0 hover:underline"
            >
              <span className="text-3xl font-semibold tabular-nums text-text">
                {t("number", { count: item.count })}
              </span>
              <span className="text-sm text-text-secondary">{label(item)}</span>
            </Link>
          </Card>
        ))}
      </ul>
    </section>
  );
}
