/**
 * PostHog's public key and host, read at request time. The names are built,
 * so Next doesn't inline a build-time value: a build without them still runs
 * with PostHog on once the deployment has them.
 */
export type PosthogEnv = { key: string; host: string };

const PREFIX = "NEXT_PUBLIC_POSTHOG_";

/** The EU ingestion host (the project's region): the only one allowed, and the default. */
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

/**
 * The browser always sends through `/ingest`, which next.config.ts rewrites
 * to PostHog EU (§6.23). So the host must be that EU host, for the server
 * too: any other value turns PostHog off rather than splitting events
 * between two places.
 */
export function posthogEnv(env: Record<string, string | undefined> = process.env): PosthogEnv | null {
  const key = env[`${PREFIX}KEY`]?.trim();
  if (!key) return null;
  const raw = env[`${PREFIX}HOST`]?.trim() || DEFAULT_POSTHOG_HOST;
  try {
    const { origin } = new URL(raw);
    return origin === DEFAULT_POSTHOG_HOST ? { key, host: origin } : null;
  } catch {
    return null;
  }
}

/** The PostHog app (for links from the toolbar), from the ingestion host. */
export function uiHost(host: string): string {
  return host.replace("://eu.i.posthog.com", "://eu.posthog.com").replace("://us.i.posthog.com", "://us.posthog.com");
}
