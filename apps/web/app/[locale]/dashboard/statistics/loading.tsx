import { useTranslations } from "next-intl";
import { StatisticsSkeleton } from "@/components/dashboard/statistics/skeleton";
import { Skeleton } from "@/components/ui";

export default function Loading() {
  const t = useTranslations("DashboardStatistics");

  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <StatisticsSkeleton label={t("loading")} />
    </div>
  );
}
