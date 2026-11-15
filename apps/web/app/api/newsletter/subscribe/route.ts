import {
  newsletterSubscribeRequestSchema,
  type ErrorCode,
  type ErrorResponse,
  type OkResponse,
} from "@repo/shared";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { protectForm, validateFormEmail, type FormLimit } from "@/lib/arcjet";
import { startSubscription } from "@/lib/newsletter/subscribe";
import ar from "@/messages/ar/Newsletter.json";
import en from "@/messages/en/Newsletter.json";

const MESSAGES = { ar, en };

/** Five signups per IP every ten minutes. */
export const NEWSLETTER_SUBSCRIBE_LIMIT: FormLimit = {
  route: "newsletter-subscribe",
  window: "10m",
  max: 5,
};

const STATUS = {
  validation_failed: 400,
  forbidden: 403,
  rate_limited: 429,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

function fail(code: keyof typeof STATUS, request: Request) {
  const locale = localeFromReferer(request.headers.get("referer"));
  const body: ErrorResponse = { error: { code, message: MESSAGES[locale].errors[code] } };
  return NextResponse.json(body, { status: STATUS[code] });
}

/**
 * `POST /api/newsletter/subscribe` (§6.15): no account needed. The answer is
 * `ok` whether the address is new, pending, confirmed or unsubscribed (§9), so
 * the form can't be used to learn who subscribed.
 */
export async function POST(request: Request) {
  const decision = await protectForm(request, NEWSLETTER_SUBSCRIBE_LIMIT);
  if (decision === "rate_limited") return fail("rate_limited", request);
  if (decision === "denied") return fail("forbidden", request);

  const parsed = newsletterSubscribeRequestSchema.safeParse(
    await request.json().catch(() => undefined),
  );
  if (!parsed.success) return fail("validation_failed", request);
  // Disposable, invalid or no mail server: the same refusal as a bad format,
  // which says nothing about who is subscribed.
  if (!(await validateFormEmail(request, parsed.data.email, NEWSLETTER_SUBSCRIBE_LIMIT.route))) {
    return fail("validation_failed", request);
  }

  // Anyone may subscribe, and Arcjet has run, so the service client writes.
  // Visitors have no grant on this table (§7).
  if ((await startSubscription(parsed.data)) === "failed") {
    return fail("internal_error", request);
  }

  const body: OkResponse = { ok: true };
  return NextResponse.json(body);
}
