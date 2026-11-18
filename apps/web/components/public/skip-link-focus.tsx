"use client";

import { useEffect } from "react";

/**
 * Moves keyboard focus to the skip link's target (WCAG 2.4.1). Following the
 * link only scrolls: `main` isn't focusable, so focus stayed on the page and
 * a screen reader didn't move with it. Renders nothing.
 */
export function SkipLinkFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(`a[href="#${targetId}"]`);
      const target = document.getElementById(targetId);
      if (!link || !target) return;
      // Focusable from script only, never in the Tab order.
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [targetId]);
  return null;
}
