import { Skeleton, StatTile } from "@/components/ui";

/**
 * The page while the KPIs load: tiles in their loading state, chart blocks.
 * One status message sits outside the busy tiles, so screen readers hear it.
 */
export function StatisticsSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li key={index}>
            <StatTile label="" state="loading" />
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
