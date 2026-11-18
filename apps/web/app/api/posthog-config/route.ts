import type { ErrorResponse, PosthogConfigResponse } from "@repo/shared";
import { connection, NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { posthogEnv } from "@/lib/analytics/env";
import ar from "@/messages/ar/Analytics.json";
import en from "@/messages/en/Analytics.json";

const MESSAGES = { ar, en };

/**
 * `GET /api/posthog-config` (§8): PostHog's public key and host, read at
 * request time. Without a key it answers 404 and the browser leaves
 * PostHog off; the site works the same.
 */
export async function GET(request: Request): Promise<Response> {
  await connection();
  const env = posthogEnv();
  if (!env) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
      );
    }
    const locale = localeFromReferer(request.headers.get("referer"));
    const body: ErrorResponse = { error: { code: "not_found", message: MESSAGES[locale].configMissing } };
    return NextResponse.json(body, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const body: PosthogConfigResponse = { key: env.key, host: env.host };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
