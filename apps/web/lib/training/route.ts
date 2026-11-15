import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Locale } from "@repo/shared";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { baseError } from "@/lib/admin/permissions";
import {
  protectForm,
  validateFormEmail,
  type FormDecision,
  type FormLimit,
} from "@/lib/arcjet";
import { localeFromReferer } from "@/lib/auth/paths";
import { queueEmail, queueEmailForPermission } from "@/lib/email/queue";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { formError } from "./errors";
import {
  createCustomTrainingRequest,
  registerForCourse,
  type TrainingDeps,
  type TrainingStore,
} from "./handlers";
import { createTrainingStore } from "./store";

/** Five custom training requests per IP every ten minutes. */
export const CUSTOM_REQUEST_LIMIT: FormLimit = {
  route: "training-custom-requests",
  window: "10m",
  max: 5,
};

export type TrainingRouteDeps = {
  /** The signed-in Clerk user, or null. */
  getUserId: () => Promise<string | null>;
  /** `userId` is null for a visitor: the store then reads no profile. */
  createStore: (userId: string | null) => TrainingStore;
  protect: (request: Request, limit: FormLimit) => Promise<FormDecision>;
  validateEmail: (request: Request, email: string, route: string) => Promise<boolean>;
} & Pick<TrainingDeps, "queueEmail" | "queueEmailForPermission" | "revalidate">;

const defaultDeps: TrainingRouteDeps = {
  getUserId: async () => (await auth()).userId,
  createStore: (userId) =>
    createTrainingStore(userId ? createUserClient() : null, createServiceClient(), userId),
  protect: protectForm,
  validateEmail: validateFormEmail,
  queueEmail,
  queueEmailForPermission,
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

function answer(result: { status: number; body: unknown }) {
  return NextResponse.json(result.body, { status: result.status });
}

function logError(label: string, error: unknown) {
  // The error's message only: codes, never row data or the request body.
  console.error(label, error instanceof Error ? error.message : "error");
}

/** `POST /api/courses/:id/register`: any signed-in user; only a client gets a seat. */
export async function handleRegister(
  request: Request,
  rawId: unknown,
  deps: TrainingRouteDeps = defaultDeps,
): Promise<Response> {
  const locale: Locale = localeFromReferer(request.headers.get("referer"));
  try {
    const userId = await deps.getUserId();
    if (!userId) return answer(baseError("unauthenticated", 401, locale));
    // The route takes no fields, so an empty or missing body is fine.
    const text = await request.text().catch(() => "");
    let body: unknown = {};
    if (text.trim() !== "") {
      try {
        body = JSON.parse(text);
      } catch {
        return answer(baseError("validation_failed", 400, locale));
      }
    }
    return answer(
      await registerForCourse(rawId, body, {
        locale,
        userId,
        store: deps.createStore(userId),
        queueEmail: deps.queueEmail,
        queueEmailForPermission: deps.queueEmailForPermission,
        revalidate: deps.revalidate,
      }),
    );
  } catch (error) {
    logError("POST /api/courses/:id/register", error);
    return answer(baseError("internal_error", 500, locale));
  }
}

/**
 * `POST /api/training/custom-requests`: no account needed. Arcjet runs before
 * the body is read. A signed-in client's request carries their id; a failed
 * session or profile read never blocks the form, it only leaves the id out.
 */
export async function handleCustomRequest(
  request: Request,
  deps: TrainingRouteDeps = defaultDeps,
): Promise<Response> {
  const locale: Locale = localeFromReferer(request.headers.get("referer"));
  try {
    const decision = await deps.protect(request, CUSTOM_REQUEST_LIMIT);
    if (decision === "rate_limited") return answer(formError("rate_limited", 429, locale));
    if (decision === "denied") return answer(formError("forbidden", 403, locale));

    const body: unknown = await request.json().catch(() => undefined);

    let userId: string | null = null;
    let clientId: string | null = null;
    try {
      userId = await deps.getUserId();
    } catch {
      userId = null;
    }
    const store = deps.createStore(userId);
    if (userId) {
      try {
        const profile = await store.ownProfile();
        if (profile?.isClient) clientId = userId;
      } catch (error) {
        logError("POST /api/training/custom-requests: profile", error);
      }
    }

    return answer(
      await createCustomTrainingRequest(body, {
        locale,
        store,
        queueEmail: deps.queueEmail,
        clientId,
        emailAccepted: (email) => deps.validateEmail(request, email, CUSTOM_REQUEST_LIMIT.route),
      }),
    );
  } catch (error) {
    logError("POST /api/training/custom-requests", error);
    return answer(formError("internal_error", 500, locale));
  }
}
