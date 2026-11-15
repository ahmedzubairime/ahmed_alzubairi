/** The query a listing page was opened with, as plain strings. */
export type ListingQuery = Readonly<Record<string, string | undefined>>;

/**
 * The query with `param` set to `value`, or removed when `value` is null.
 * `drop` names params that reset, such as `page` when a filter changes.
 * Empty values are left out, so links stay short and canonical.
 */
export function withParam(
  query: ListingQuery,
  param: string,
  value: string | null,
  drop: readonly string[] = [],
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, current] of Object.entries(query)) {
    if (key === param || drop.includes(key) || !current) continue;
    next[key] = current;
  }
  if (value) next[param] = value;
  return next;
}

/** A page number, or a gap between page numbers. */
export type PageItem = { kind: "page"; page: number } | { kind: "gap"; key: string };

/**
 * The page links to show: always the first and last pages, the current one
 * and `around` on each side, with a gap where pages are skipped. A gap never
 * hides a single page: that page shows instead.
 */
export function pageItems(current: number, total: number, around = 1): PageItem[] {
  if (total < 1) return [];
  const page = Math.min(Math.max(1, Math.trunc(current)), total);
  const shown = new Set<number>([1, total]);
  for (let p = page - around; p <= page + around; p++) {
    if (p >= 1 && p <= total) shown.add(p);
  }
  const sorted = [...shown].sort((a, b) => a - b);

  const items: PageItem[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (p - previous === 2) items.push({ kind: "page", page: p - 1 });
    else if (p - previous > 2) items.push({ kind: "gap", key: `gap-${previous}` });
    items.push({ kind: "page", page: p });
    previous = p;
  }
  return items;
}

export type ShareNetwork = "whatsapp" | "x" | "linkedin" | "facebook" | "email";

export const SHARE_NETWORKS: readonly ShareNetwork[] = ["whatsapp", "x", "linkedin", "facebook", "email"];

/**
 * Plain share URLs: each network's own share page. No network script loads
 * on our pages, so sharing sends nothing anywhere until the visitor clicks.
 */
export function shareHref(network: ShareNetwork, url: string, title: string): string {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (network) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case "x":
      return `https://x.com/intent/post?url=${u}&text=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "email":
      return `mailto:?subject=${t}&body=${u}`;
  }
}

/** Seats left, clamped to 0…total. A course with no seat limit has no meter. */
export function seatsLeftRatio(left: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(left, 0), total) / total;
}
