import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { noindexMetadata } from "@/lib/seo";
import { AppShell } from "@/components/app-shell";
import { AppClerkProvider } from "@/components/clerk/app-clerk-provider";
import { ACCOUNT_NAV } from "@/components/nav-items";

// Private pages stay out of search engines (§6.24); child pages inherit it.
export const metadata = noindexMetadata;

export default function AccountLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Account");

  return (
    <AppClerkProvider>
      <AppShell
        title={t("title")}
        navLabel={t("navLabel")}
        links={ACCOUNT_NAV.map(({ href, label }) => ({ href, label: t(label) }))}
      >
        {children}
      </AppShell>
    </AppClerkProvider>
  );
}
