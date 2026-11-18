import type { PosthogConfigResponse } from "@repo/shared";
import { connection, NextResponse } from "next/server";
import { posthogEnv } from "@/lib/analytics/env";

/**
 * `GET /api/posthog-config` (§8): PostHog's public key and host, read at
 * request time. Without a key it answers 204 (no body) and the browser leaves
 * PostHog off; the site works the same.
 */
export async function GET(): Promise<Response> {
  await connection();
  const env = posthogEnv();
  if (!env) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
      );
    }
    // 204, not 404: a browser logs every failed fetch as a console error,
    // and "off" isn't an error. §8 names no status for it.
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }
  const body: PosthogConfigResponse = { key: env.key, host: env.host };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
