import "server-only";
import { NextResponse } from "next/server";
import { protectForm, validateFormEmail, type FormDecision, type FormLimit } from "@/lib/arcjet";
import { localeFromReferer } from "@/lib/auth/paths";
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
};

const defaultDeps: ResourceRouteDeps = {
  protect: (request) => protectForm(request, RESOURCE_DOWNLOAD_LIMIT),
  createStore: () => createResourceStore(createServiceClient()),
  isAcceptableEmail: (request, email) =>
    validateFormEmail(request, email, RESOURCE_DOWNLOAD_LIMIT.route),
};

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
          : await downloadResource(id, await request.json().catch(() => undefined), {
              locale,
              store: deps.createStore(),
              isAcceptableEmail: (email) => deps.isAcceptableEmail(request, email),
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
