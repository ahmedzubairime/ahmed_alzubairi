import Image from "next/image";
import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** A card on a listing page. The whole card is the link target when it has one. */
export const LISTING_CARD =
  "relative flex flex-col overflow-hidden rounded-lg border border-text/10 bg-surface text-text shadow-sm";

/** A card's title link. Its ::after covers the card, so the card is one target. */
export const TITLE_LINK =
  "rounded-sm after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Actions inside a card sit above the title link's overlay. */
export const ABOVE_LINK = "relative z-10";

export type ListingImage = { src: string; alt: string };

/**
 * A card's picture at 16:9, lazy and sized for a three-column grid. Without
 * one, a quiet panel with the card's icon keeps the grid even.
 */
export function CardCover({ image, fallback }: { image: ListingImage | null; fallback: ReactNode }) {
  return (
    <div className="relative aspect-video shrink-0 bg-text/5">
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
      ) : (
        <div aria-hidden="true" className="flex h-full items-center justify-center text-text-secondary/60">
          {fallback}
        </div>
      )}
      {/* A thin gold line under the picture: gold as a divider (§13). */}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
    </div>
  );
}

/** Short facts on one line, split by a dot, wrapping on phones. */
export function MetaLine({ items: all, className }: { items: ReactNode[]; className?: string }) {
  const items = all.filter(Boolean);
  if (items.length === 0) return null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary", className)}>
      {items.map((item, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

export function Heading({ level, className, children }: { level: 2 | 3; className?: string; children: ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag className={cx("text-balance", className)}>{children}</Tag>;
}
