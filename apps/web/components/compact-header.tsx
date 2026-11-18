import type { ReactNode } from "react";
import { LanguageSwitch } from "./language-switch";
import { SiteLogo } from "./site-logo";
import { ThemeSwitch } from "./theme-switch";

/** The top bar for screens without the public menu. */
export function CompactHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-text/10 bg-surface">
      {/* At least 56 px, taller when the name wraps. */}
      <div className="flex min-h-14 items-center gap-2 px-4 py-2">
        {/* The site name is never cut off: it wraps (a step smaller on phones)
            instead of the logo's ellipsis, which hid it next to the controls. */}
        <div className="min-w-0 [&>a]:block [&>a]:overflow-visible [&>a]:text-lg [&>a]:leading-tight [&>a]:whitespace-normal sm:[&>a]:text-xl">
          <SiteLogo />
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <LanguageSwitch />
          <ThemeSwitch />
          {children}
        </div>
      </div>
    </header>
  );
}
