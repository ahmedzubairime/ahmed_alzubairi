import type { ReactNode } from "react";
import { LazyClerk } from "@/components/clerk/lazy-clerk";
import { LanguageFallbackProvider } from "@/components/language-switch";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";

// Public pages stay cached: never read the session here (§13).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <LanguageFallbackProvider>
      <SkipLink />
      <SiteHeader />
      {children}
      <SiteFooter />
      {/* Clerk loads after idle, beside the page (§13 Performance). */}
      <LazyClerk />
    </LanguageFallbackProvider>
  );
}
