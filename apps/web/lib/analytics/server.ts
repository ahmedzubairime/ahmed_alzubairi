import "server-only";
import { posthogEnv, type PosthogEnv } from "./env";
import { stripUrl } from "./sanitize";

/** Every server event's distinct id: never a user's (§9). */
export const SERVER_DISTINCT_ID = "server";

/** What `onRequestError` passes that we may send: the path and route, never headers or body. */
export type ServerErrorContext = {
  path: string;
  method?: string;
  routerKind?: string;
  routePath?: string;
  routeType?: string;
};

type Client = {
  captureExceptionImmediate: (
    error: unknown,
    options?: { distinctId?: string; properties?: Record<string, unknown> },
  ) => Promise<void>;
  shutdown: () => Promise<void>;
};

export type CaptureDeps = {
  env?: PosthogEnv | null;
  create?: (env: PosthogEnv) => Promise<Client>;
};

async function createClient({ key, host }: PosthogEnv): Promise<Client> {
  const { PostHog } = await import("posthog-node");
  // Serverless: send at once, nothing waits in a queue.
  return new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
}

/**
 * Sends one server error to PostHog Error tracking and waits until it is
 * sent, so a Vercel function doesn't stop first. A no-op without the key. It
 * never throws: reporting an error must not add one.
 */
export async function captureServerError(
  error: unknown,
  context: ServerErrorContext,
  { env = posthogEnv(), create = createClient }: CaptureDeps = {},
): Promise<void> {
  if (!env) return;
  try {
    const client = await create(env);
    try {
      await client.captureExceptionImmediate(error, {
        distinctId: SERVER_DISTINCT_ID,
        properties: {
          $current_url: stripUrl(context.path),
          $pathname: stripUrl(context.path),
          method: context.method,
          router_kind: context.routerKind,
          route_path: context.routePath,
          route_type: context.routeType,
        },
      });
    } finally {
      await client.shutdown();
    }
  } catch (failure) {
    console.error("analytics: server error capture failed", failure instanceof Error ? failure.name : "unknown");
  }
}
