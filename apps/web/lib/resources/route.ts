import "server-only";
import type { Locale } from "@repo/shared";
import { after, NextResponse } from "next/server";
import { protectForm, validateFormEmail, type FormDecision, type FormLimit } from "@/lib/arcjet";
import { localeFromReferer } from "@/lib/auth/paths";
import { startSubscription } from "@/lib/newsletter/subscribe";
import { createServiceClient } from "@/lib/supabase/service";
import { fail } from "./errors";
import { downloadResource, type ResourceStore } from "./handlers";
import { createResourceStore } from "./store";

/** Twenty downloads per IP every ten minutes. */
export const RESOURCE_DOWNLOAD_LIMIT: FormLimit = { route: "resource-download", window: "10m", max: 20 };

export type ResourceRouteDeps = {
  protect: (request: Request) => Promise<FormDecision>;
  /** Called only once Arcjet lets the request through. */
  createStore: () => ResourceStore;
  isAcceptableEmail: (request: Request, email: string) => Promise<boolean>;
  /** Returns at once; see `ResourceDownloadDeps.subscribe`. */
  subscribe: (email: string, locale: Locale) => void;
};

/**
 * The email gate's newsletter signup: double opt-in, source `resource`
 * (§6.15). It never throws, and it logs no address.
 */
export async function subscribeFromDownload(email: string, locale: Locale): Promise<void> {
  try {
    await startSubscription({ email, locale, source: "resource" });
  } catch {
    console.error("resource download: newsletter signup failed");
  }
}

const defaultDeps: ResourceRouteDeps = {
  protect: (request) => protectForm(request, RESOURCE_DOWNLOAD_LIMIT),
  createStore: () => createResourceStore(createServiceClient()),
  isAcceptableEmail: (request, email) =>
    validateFormEmail(request, email, RESOURCE_DOWNLOAD_LIMIT.route),
  // After the response is sent: the visitor's file never waits on the signup.
  subscribe: (email, locale) => after(() => subscribeFromDownload(email, locale)),
};

/**
 * A direct download needs no body, so an empty one reads as `{}`. Anything
 * else must be JSON: text that doesn't parse reads as `undefined`, which the
 * schema refuses, as it refuses `null`.
 */
async function readBody(request: Request): Promise<unknown> {
  const raw = await request.text().catch(() => undefined);
  if (raw === undefined) return undefined;
  if (raw.trim() === "") return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/** `POST /api/resources/:id/download`: no account needed. */
export async function handleResourceDownloadRequest(
  request: Request,
  id: string,
  deps: ResourceRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const decision = await deps.protect(request);
    const result =
      decision === "rate_limited"
        ? fail("rateLimited", locale)
        : decision === "denied"
          ? fail("denied", locale)
          : await downloadResource(id, await readBody(request), {
              locale,
              store: deps.createStore(),
              isAcceptableEmail: (email) => deps.isAcceptableEmail(request, email),
              subscribe: deps.subscribe,
            });
    // The body carries a short-lived URL, so nothing may cache it.
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // The error is a store failure: it carries no email and no storage key.
    console.error("POST /api/resources/:id/download", error instanceof Error ? error.message : "failed");
    const failure = fail("internal", locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
