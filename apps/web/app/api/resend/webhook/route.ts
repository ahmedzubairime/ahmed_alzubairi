import {
  resendContactUpdatedEventSchema,
  type ErrorCode,
  type ErrorResponse,
  type OkResponse,
} from "@repo/shared";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { markUnsubscribed } from "@/lib/newsletter/unsubscribe";
import ar from "@/messages/ar.json";

const ROUTE = "POST /api/resend/webhook";
const SECRET_ENV = "RESEND_WEBHOOK_SECRET";

const STATUS = {
  unauthenticated: 401,
  internal_error: 500,
} as const satisfies Partial<Record<ErrorCode, number>>;

// Resend's servers call this route, so there is no page language to answer in.
function fail(code: keyof typeof STATUS) {
  const body: ErrorResponse = { error: { code, message: ar.Errors[code] } };
  return NextResponse.json(body, { status: STATUS[code] });
}

function ok() {
  const body: OkResponse = { ok: true };
  return NextResponse.json(body);
}

/**
 * Checks the Svix signature over the raw body and answers the event, or null
 * when the signature, the id or the timestamp is wrong or too old. The check
 * is local: it makes no request and uses no API key, so the client is given a
 * placeholder.
 */
function verified(payload: string, request: NextRequest, webhookSecret: string): unknown {
  try {
    return new Resend("re_signature_check_only").webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    });
  } catch {
    return null;
  }
}

/**
 * `POST /api/resend/webhook` (§8 System): records unsubscribes (§6.15). The
 * signature is the route's only protection (§9), so it is checked before
 * anything is read or written. No Arcjet here: a bot rule would refuse
 * Resend's servers.
 *
 * Only `contact.updated` with `unsubscribed: true` does anything. It only
 * ever sets `unsubscribed`, so events that arrive twice or out of order are
 * safe, and no event can subscribe anyone. Nothing from the payload is logged.
 */
export async function POST(request: NextRequest) {
  // Read at request time, so the build passes without it. Never a pass.
  const secret = process.env[SECRET_ENV];
  if (!secret) {
    console.error(`${ROUTE}: ${SECRET_ENV} is not set`);
    return fail("internal_error");
  }

  const event = verified(await request.text(), request, secret);
  if (event === null) {
    console.warn(`${ROUTE}: signature refused`);
    return fail("unauthenticated");
  }

  const parsed = resendContactUpdatedEventSchema.safeParse(event);
  if (!parsed.success || !parsed.data.data.unsubscribed) return ok();

  // The signature proves Resend sent this, so the service client writes (§9).
  // A 500 makes Resend send the event again.
  if (!(await markUnsubscribed(parsed.data.data.email))) return fail("internal_error");
  return ok();
}
