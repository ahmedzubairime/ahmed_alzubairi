import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeEmail } from "./subscribe";

/**
 * Records an unsubscribe Resend reported (§6.15). The row stays, as
 * `unsubscribed`, and any confirm link still out stops working. An address
 * with no row changes nothing. False when the database refused the write.
 */
export async function markUnsubscribed(email: string): Promise<boolean> {
  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", confirm_token_hash: null })
    .eq("email", normalizeEmail(email));
  if (error) {
    console.error(`newsletter: unsubscribe not recorded (${error.code || "error"})`);
    return false;
  }
  return true;
}
