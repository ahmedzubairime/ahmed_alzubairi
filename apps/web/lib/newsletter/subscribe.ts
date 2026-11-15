import "server-only";
import type { Locale, NewsletterSource } from "@repo/shared";
import { queueEmail } from "@/lib/email/queue";
import { createServiceClient } from "@/lib/supabase/service";
import { addToAudience } from "./audience";
import { hashConfirmToken, newConfirmToken } from "./token";

/**
 * Every newsletter signup starts here (§6.15): the footer, home and blog
 * forms, and the resource email gate. Double opt-in: the row is `pending`
 * until the link in the confirm email is opened, and nothing else is ever sent
 * to it.
 *
 * Logs carry codes only: never an address or a token.
 */

/** `failed` means the database couldn't be read or written, whatever the row. */
export type StartSubscriptionResult = "ok" | "failed";

const PG_UNIQUE_VIOLATION = "23505";

function logFailure(step: string, error: { code?: string } | null) {
  console.error(`newsletter: ${step} failed (${error?.code || "error"})`);
}

/** One spelling per address, so `email`'s unique index catches every repeat. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The site's own address from `NEXT_PUBLIC_APP_URL`, never from the request:
 * a forged Host header must not put another site in the confirm link.
 */
function confirmUrl(token: string): string | null {
  const base = process.env["NEXT_PUBLIC_APP_URL"];
  if (!base || !URL.canParse(base)) return null;
  const { origin, pathname } = new URL(base);
  const url = new URL(`${origin}${pathname.replace(/\/+$/, "")}/api/newsletter/confirm`);
  url.searchParams.set("token", token);
  return url.href;
}

/**
 * Starts (or restarts) a subscription and queues its confirm email.
 *
 * - No row: a new `pending` row.
 * - `pending` or `unsubscribed`: back to `pending` with a new token, so the
 *   old link stops working.
 * - `confirmed`: left alone, and no email. The address is sent to the Resend
 *   segment again, which repairs a sync that failed when it was confirmed.
 *
 * The answer never says which of these happened (§9): `ok` for all three. A
 * confirm email that can't be queued is logged and still answers `ok`.
 */
export async function startSubscription(input: {
  email: string;
  locale: Locale;
  source: NewsletterSource;
}): Promise<StartSubscriptionResult> {
  const email = normalizeEmail(input.email);
  const service = createServiceClient();
  const token = newConfirmToken();
  const pending = {
    status: "pending",
    confirm_token_hash: hashConfirmToken(token),
    locale: input.locale,
    source: input.source,
    consented_at: new Date().toISOString(),
  };

  const inserted = await service.from("newsletter_subscribers").insert([{ email, ...pending }]);
  if (inserted.error) {
    if (inserted.error.code !== PG_UNIQUE_VIOLATION) {
      logFailure("insert", inserted.error);
      return "failed";
    }
    // The address has a row. One statement restarts it unless it is
    // confirmed, so a confirm landing at the same moment is never undone.
    const restarted = await service
      .from("newsletter_subscribers")
      .update(pending)
      .eq("email", email)
      .neq("status", "confirmed")
      .select("id");
    if (restarted.error) {
      logFailure("restart", restarted.error);
      return "failed";
    }
    // Confirmed already: nothing to send. Asking again is fresh consent, so
    // make sure Resend has the address (idempotent; a failure is only logged).
    if (restarted.data.length === 0) {
      await addToAudience(email);
      return "ok";
    }
  }

  const url = confirmUrl(token);
  if (!url) {
    console.error("newsletter: NEXT_PUBLIC_APP_URL is not set, confirm email not queued");
    return "ok";
  }
  // The queue logs its own failures, without the address.
  await queueEmail({
    event: "newsletter_confirm",
    to: { email, locale: input.locale },
    payload: { confirmUrl: url },
  });
  return "ok";
}
