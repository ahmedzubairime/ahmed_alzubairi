"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { CheckIcon, LinkIcon } from "./icons";

type State = "idle" | "copied" | "failed";

/**
 * Copies `url` with the Clipboard API. The labels come from the server parent,
 * so this island needs no message bundle. The result is announced politely.
 */
export function CopyLinkButton({
  url,
  labels,
  className,
}: {
  url: string;
  labels: { copy: string; copied: string; failed: string };
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 3000);
  }

  return (
    <>
      <button type="button" onClick={copy} className={className}>
        {state === "copied" ? <CheckIcon className="size-5" /> : <LinkIcon className="size-5" />}
        <span className="sr-only sm:not-sr-only">{state === "copied" ? labels.copied : labels.copy}</span>
      </button>
      <span role="status" className={cx("text-sm text-text-secondary", state !== "failed" && "sr-only")}>
        {state === "copied" ? labels.copied : state === "failed" ? labels.failed : ""}
      </span>
    </>
  );
}
