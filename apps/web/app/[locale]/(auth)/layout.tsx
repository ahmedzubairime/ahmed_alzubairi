import type { ReactNode } from "react";
import { noindexMetadata } from "@/lib/seo";
import { AppClerkProvider } from "@/components/clerk/app-clerk-provider";
import { CompactHeader } from "@/components/compact-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";

// Private pages stay out of search engines (§6.24); child pages inherit it.
export const metadata = noindexMetadata;

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <AppClerkProvider>
      <SkipLink />
      <CompactHeader />
      <main
        id={MAIN_CONTENT_ID}
        className="flex flex-1 items-start justify-center p-4 sm:items-center"
      >
        {children}
      </main>
    </AppClerkProvider>
  );
}
