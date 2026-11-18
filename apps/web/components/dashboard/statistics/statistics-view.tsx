import { getTranslations } from "next-intl/server";
import { MonthlyChart, StatTile, type MonthlyValue } from "@/components/ui";
import type { KpiResult, Statistics } from "./data";
import { FIRST_REPLY_DAYS, FIRST_REPLY_ROW_CAP } from "./data";
import { lastTwo, monthChange, plotted, sharePercent } from "./format";
import { monthLabel } from "./months";

type Tile = { key: string; tile: React.ReactNode; chart?: React.ReactNode };

/**
 * The KPIs the member may see (§6.23): a tile row for this month, then one
 * chart per KPI. An unavailable KPI keeps its tile, saying so, and has no
 * chart. Every number is formatted with Intl in the page's language.
 */
export async function StatisticsView({ statistics, locale }: { statistics: Statistics; locale: "ar" | "en" }) {
  const t = await getTranslations("DashboardStatistics");
  const keys = statistics.windows.map((window) => window.key);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const series = (values: readonly (number | null)[]): MonthlyValue[] =>
    keys.flatMap((key, index) => {
      const value = values[index];
      return value === null || value === undefined ? [] : [{ label: monthLabel(key, locale), value }];
    });
  const chart = (title: string, values: readonly (number | null)[], extra: { description?: string; valueFormat?: Intl.NumberFormatOptions; keepZeros?: boolean } = {}) => {
    const data = series(values);
    return (
      <MonthlyChart
        title={title}
        description={extra.description}
        data={extra.keepZeros ? data : plotted(data)}
        locale={locale}
        valueFormat={extra.valueFormat}
        monthHeader={t("chart.month")}
        valueHeader={t("chart.value")}
        emptyLabel={t("chart.empty")}
        tableToggleLabel={t("chart.showValues")}
      />
    );
  };
  const vsLastMonth = t("vsLastMonth");

  const build = (kpi: KpiResult): Tile => {
    const label = t(`kpis.${kpi.key}.label`);
    if ("unavailable" in kpi) {
      return { key: kpi.key, tile: <StatTile label={label} state="unavailable" unavailableLabel={t("unavailable")} /> };
    }
    switch (kpi.key) {
      case "firstReply":
        return {
          key: kpi.key,
          tile: (
            <StatTile
              label={label}
              value={kpi.recent === null ? undefined : number.format(kpi.recent)}
              unit={kpi.recent === null ? undefined : t("kpis.firstReply.unit")}
              hint={
                kpi.recent === null
                  ? t("kpis.firstReply.none", { days: FIRST_REPLY_DAYS })
                  : `${t("kpis.firstReply.hint", { days: FIRST_REPLY_DAYS })}${kpi.capped ? ` ${t("kpis.firstReply.capped", { count: FIRST_REPLY_ROW_CAP })}` : ""}`
              }
              state={kpi.recent === null ? "unavailable" : "ready"}
              unavailableLabel={t("kpis.firstReply.none", { days: FIRST_REPLY_DAYS })}
            />
          ),
          chart: chart(t("kpis.firstReply.chart"), kpi.months.map((value) => (value === null ? null : Math.round(value * 10) / 10)), {
            description: t("kpis.firstReply.chartNote"),
            valueFormat: { maximumFractionDigits: 1 },
            keepZeros: true,
          }),
        };
      case "newsletter":
        return {
          key: kpi.key,
          tile: (
            <StatTile
              label={label}
              value={number.format(kpi.total)}
              hint={t("kpis.newsletter.hint", { count: lastTwo(kpi.months).current })}
            />
          ),
          chart: chart(t("kpis.newsletter.chart"), kpi.months, { description: t("kpis.newsletter.chartNote") }),
        };
      case "signupShare": {
        const shares = kpi.signups.map((signups, index) => sharePercent(signups, kpi.visitors[index] ?? 0));
        const { current } = lastTwo(shares);
        return {
          key: kpi.key,
          tile: (
            <StatTile
              label={label}
              value={new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(current / 100)}
              hint={t("kpis.signupShare.hint", {
                signups: number.format(lastTwo(kpi.signups).current),
                visitors: number.format(lastTwo(kpi.visitors).current),
              })}
            />
          ),
          chart: chart(t("kpis.signupShare.chart"), shares, { description: t("approximate"), valueFormat: { maximumFractionDigits: 1 } }),
        };
      }
      default:
        return {
          key: kpi.key,
          tile: (
            <StatTile
              label={label}
              value={number.format(lastTwo(kpi.months).current)}
              change={monthChange(kpi.months, locale, vsLastMonth)}
            />
          ),
          chart: chart(t(`kpis.${kpi.key}.chart`), kpi.months),
        };
    }
  };

  const tiles = statistics.kpis.map(build);
  const charts = tiles.filter((item) => item.chart);
  const visitors = statistics.kpis.some((kpi) => kpi.key === "signupShare");

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((item) => (
          <li key={item.key} className="min-w-0">
            {item.tile}
          </li>
        ))}
      </ul>
      {charts.length > 0 && (
        <ul className="grid gap-4 lg:grid-cols-2">
          {charts.map((item) => (
            <li key={item.key} className="min-w-0">
              {item.chart}
            </li>
          ))}
        </ul>
      )}
      {visitors && <p className="text-sm text-pretty text-text-secondary">{t("approximate")}</p>}
    </div>
  );
}
