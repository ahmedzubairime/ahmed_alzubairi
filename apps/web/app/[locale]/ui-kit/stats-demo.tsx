"use client";

import { useLocale } from "next-intl";
import { useState, type ReactNode } from "react";
import { ConsentBanner } from "@/components/consent-banner";
import { Button, MonthlyChart, SectionHeading, StatTile } from "@/components/ui";

// Sample copy for the dev-only kit page, like content.ts. Made up numbers.
const SAMPLE = {
  ar: {
    title: "الإحصاءات وملفات تعريف الارتباط",
    intro: "بطاقة المؤشر بحالاتها، والرسم الشهري، وشريط الموافقة على ملفات تعريف الارتباط.",
    tiles: "بطاقات المؤشرات",
    tilesIntro: "قيمة جاهزة، ثم أثناء التحميل، ثم مصدر تعذّر الوصول إليه.",
    consultations: "طلبات الاستشارة الشهرية",
    signups: "نسبة الزوار الذين أنشؤوا حسابًا",
    reply: "متوسط وقت أول رد",
    replyUnit: "ساعة",
    replyHint: "داخلي، لا يظهر للعملاء.",
    downloads: "تحميلات الموارد",
    vsLastMonth: "مقارنة بالشهر الماضي",
    loading: "جارٍ تحميل المؤشر…",
    unavailable: "غير متاح حاليًا",
    chart: "الرسم الشهري",
    chartIntro: "اثنا عشر شهرًا، والأقدم في جهة البداية. يتجه الزمن من اليمين إلى اليسار بالعربية.",
    chartTitle: "طلبات الاستشارة، آخر ١٢ شهرًا",
    chartDescription: "عدد الطلبات الجديدة في كل شهر.",
    emptyTitle: "تسجيلات الدورات، آخر ٦ أشهر",
    empty: "لا توجد بيانات لهذه الفترة بعد.",
    month: "الشهر",
    requests: "الطلبات",
    banner: "شريط ملفات تعريف الارتباط",
    bannerIntro: "مثبّت أسفل الصفحة، والزرّان بالوزن نفسه. يمكن الوصول إليهما بمفتاح Tab ولا يحبس التركيز.",
    showBanner: "إظهار الشريط",
    choice: "آخر اختيار:",
    accepted: "قبول",
    declined: "رفض",
  },
  en: {
    title: "Statistics and cookies",
    intro: "The KPI tile and its states, the monthly chart, and the cookie consent banner.",
    tiles: "KPI tiles",
    tilesIntro: "A ready value, then loading, then a source that failed.",
    consultations: "Monthly consultation requests",
    signups: "Visitors who create an account",
    reply: "Average time to first reply",
    replyUnit: "hours",
    replyHint: "Internal, never shown to clients.",
    downloads: "Resource downloads",
    vsLastMonth: "vs last month",
    loading: "Loading the KPI…",
    unavailable: "Not available right now",
    chart: "Monthly chart",
    chartIntro: "Twelve months, oldest on the start side. Time runs right to left in Arabic.",
    chartTitle: "Consultation requests, last 12 months",
    chartDescription: "New requests each month.",
    emptyTitle: "Course registrations, last 6 months",
    empty: "No data for this period yet.",
    month: "Month",
    requests: "Requests",
    banner: "Cookie banner",
    bannerIntro: "Fixed to the bottom, with two buttons of the same weight. Both are reachable by Tab, and focus isn't trapped.",
    showBanner: "Show the banner",
    choice: "Last choice:",
    accepted: "Accept",
    declined: "Decline",
  },
};

const MONTHLY = [14, 18, 11, 23, 27, 19, 31, 0, 26, 34, 29, 38];

function Block({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-text/10 pt-8">
      <SectionHeading title={title} intro={intro} level={3} />
      {children}
    </section>
  );
}

export function StatsDemo() {
  const locale = useLocale();
  const t = SAMPLE[locale === "ar" ? "ar" : "en"];
  const [bannerOpen, setBannerOpen] = useState(true);
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);

  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const signed = new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 0 });
  // Twelve months ending in November 2026, formatted the way a caller would.
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const months = MONTHLY.map((value, index) => ({
    label: monthFormat.format(new Date(Date.UTC(2025, 11 + index, 1))),
    value,
  }));

  const decide = (value: "accepted" | "declined") => {
    setChoice(value);
    setBannerOpen(false);
  };

  return (
    <div className="space-y-10">
      <SectionHeading title={t.title} intro={t.intro} />

      <Block title={t.tiles} intro={t.tilesIntro}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={t.consultations}
            value={number.format(38)}
            change={{ direction: "up", tone: "better", value: signed.format(0.31), label: t.vsLastMonth }}
          />
          <StatTile
            label={t.signups}
            value={percent.format(0.042)}
            change={{ direction: "down", tone: "worse", value: signed.format(-0.08), label: t.vsLastMonth }}
          />
          <StatTile
            label={t.reply}
            value={number.format(5.5)}
            unit={t.replyUnit}
            hint={t.replyHint}
            change={{ direction: "down", tone: "better", value: signed.format(-0.12), label: t.vsLastMonth }}
          />
          <StatTile label={t.downloads} value={number.format(1284)} change={{ direction: "flat", tone: "neutral", value: signed.format(0), label: t.vsLastMonth }} />
          <StatTile label={t.consultations} state="loading" loadingLabel={t.loading} />
          <StatTile label={t.signups} state="unavailable" unavailableLabel={t.unavailable} />
        </div>
      </Block>

      <Block title={t.chart} intro={t.chartIntro}>
        <div className="grid gap-4 lg:grid-cols-2">
          <MonthlyChart
            title={t.chartTitle}
            description={t.chartDescription}
            data={months}
            locale={locale}
            monthHeader={t.month}
            valueHeader={t.requests}
            emptyLabel={t.empty}
          />
          <MonthlyChart title={t.emptyTitle} data={[]} locale={locale} monthHeader={t.month} valueHeader={t.requests} emptyLabel={t.empty} />
        </div>
      </Block>

      <Block title={t.banner} intro={t.bannerIntro}>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setBannerOpen(true)} disabled={bannerOpen}>
            {t.showBanner}
          </Button>
          {choice && (
            <p className="text-sm text-text-secondary" role="status">
              {t.choice} {t[choice]}
            </p>
          )}
        </div>
      </Block>

      <ConsentBanner
        open={bannerOpen}
        onAccept={() => decide("accepted")}
        onDecline={() => decide("declined")}
        privacyHref="/privacy"
      />
    </div>
  );
}
