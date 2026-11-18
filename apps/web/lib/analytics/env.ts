/**
 * PostHog's public key and host, read at request time. The names are built,
 * so Next doesn't inline a build-time value: a build without them still runs
 * with PostHog on once the deployment has them.
 */
export type PosthogEnv = { key: string; host: string };

const PREFIX = "NEXT_PUBLIC_POSTHOG_";

/** The EU ingestion host (the project's region), used when HOST is unset. */
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export function posthogEnv(env: Record<string, string | undefined> = process.env): PosthogEnv | null {
  const key = env[`${PREFIX}KEY`]?.trim();
  if (!key) return null;
  const raw = env[`${PREFIX}HOST`]?.trim() || DEFAULT_POSTHOG_HOST;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return { key, host: url.origin };
  } catch {
    return null;
  }
}

/** The PostHog app (for links from the toolbar), from the ingestion host. */
export function uiHost(host: string): string {
  return host.replace("://eu.i.posthog.com", "://eu.posthog.com").replace("://us.i.posthog.com", "://us.posthog.com");
}
