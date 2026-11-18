import { useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";
import { noindexMetadata } from "@/lib/seo";
import { AppShell } from "@/components/app-shell";
import {
  DashboardNav,
  DashboardNavSkeleton,
} from "@/components/dashboard/dashboard-nav";

// Private pages stay out of search engines (§6.24); child pages inherit it.
export const metadata = noindexMetadata;

export default function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const t = useTranslations("Dashboard");

  return (
    <AppShell
      title={t("title")}
      navLabel={t("navLabel")}
      links={[]}
      menu={
        // The menu reads the session, so it streams in after the shell.
        <Suspense fallback={<DashboardNavSkeleton />}>
          <DashboardNav params={params} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
