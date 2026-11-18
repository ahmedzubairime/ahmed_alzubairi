import { auth } from "@clerk/nextjs/server";
import { LOCALES } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { grantedPermissions } from "@/components/dashboard/access";
import { Refusal } from "@/components/dashboard/refusal";
import { loadStatistics, STATISTICS_PERMISSIONS } from "@/components/dashboard/statistics/data";
import { viewerTimeZone } from "@/components/dashboard/statistics/months";
import { StatisticsSkeleton } from "@/components/dashboard/statistics/skeleton";
import { StatisticsView } from "@/components/dashboard/statistics/statistics-view";
import { PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";
import { createUserClient } from "@/lib/supabase/user";

type Params = Promise<{ locale: string }>;

/**
 * The viewer's profile time zone, read with their own client; UTC when the
 * profile has none. A failed read throws, so the page offers a retry instead
 * of quietly counting in the wrong zone.
 */
async function profileTimeZone(): Promise<string> {
  const { userId } = await auth();
  if (!userId) return "UTC";
  const { data, error } = await createUserClient()
    .from("profiles")
    .select("timezone")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`statistics: time zone read failed: ${error.code}`);
  return viewerTimeZone(data?.timezone);
}

async function Body({
  granted,
  locale,
  timeZone,
}: {
  granted: Awaited<ReturnType<typeof grantedPermissions>>;
  locale: "ar" | "en";
  timeZone: string;
}) {
  const statistics = await loadStatistics(granted, timeZone);
  return <StatisticsView statistics={statistics} locale={locale} />;
}

/**
 * Statistics (§6.20, §6.23). Opens for a member holding any KPI's permission;
 * each KPI then shows only with its own (checked on the server, read with
 * the member's client). Never a role name.
 */
export default async function StatisticsPage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/statistics");
  const { locale: raw } = await params;
  const locale = LOCALES.find((item) => item === raw) ?? "ar";
  const granted = await grantedPermissions(STATISTICS_PERMISSIONS, locale);
  if (granted.size === 0) return <Refusal />;
  const [t, timeZone] = await Promise.all([getTranslations("DashboardStatistics"), profileTimeZone()]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} intro={t("intro", { timeZone })} />
      <Suspense fallback={<StatisticsSkeleton label={t("loading")} />}>
        <Body granted={granted} locale={locale} timeZone={timeZone} />
      </Suspense>
    </div>
  );
}
