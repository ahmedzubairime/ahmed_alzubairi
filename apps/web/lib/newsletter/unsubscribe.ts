import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeEmail } from "./subscribe";

/**
 * Records an unsubscribe Resend reported (§6.15). The row stays, as
 * `unsubscribed`. An address with no row changes nothing. False when the
 * database refused the write.
 *
 * Webhooks can arrive late or out of order, so one statement decides whether
 * the event still applies:
 * - Only a `confirmed` row changes. Only confirmed addresses are in Resend,
 *   and a `pending` row is a newer signup: its confirm link must keep working.
 * - With `eventAt` (the event's own time), a row whose consent is newer than
 *   the event is left alone: the person subscribed again after that opt-out.
 */
export async function markUnsubscribed(email: string, eventAt?: Date): Promise<boolean> {
  let update = createServiceClient()
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", confirm_token_hash: null })
    .eq("email", normalizeEmail(email))
    .eq("status", "confirmed");
  if (eventAt) update = update.lte("consented_at", eventAt.toISOString());
  const { error } = await update;
  if (error) {
    console.error(`newsletter: unsubscribe not recorded (${error.code || "error"})`);
    return false;
  }
  return true;
}
