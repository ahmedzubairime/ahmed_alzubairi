import "server-only";
import { localeSchema, type Locale } from "@repo/shared";
import { createServiceClient } from "@/lib/supabase/service";
import { addToAudience } from "./audience";
import { hashConfirmToken } from "./token";

/**
 * The second half of the double opt-in (§6.15).
 *
 * - `confirmed`: the token matched a `pending` row, which is now `confirmed`.
 * - `invalid`: no pending row holds this token (wrong, used, or replaced).
 * - `failed`: the database couldn't be written; the token still works.
 */
export type ConfirmResult =
  | { status: "confirmed"; locale: Locale }
  | { status: "invalid" }
  | { status: "failed" };

/**
 * Confirms in one statement, so a token works once even when the link is
 * opened twice at the same moment. The hash is cleared with it.
 *
 * Then the address goes to the Resend segment. A Resend failure never undoes
 * the confirm: it is logged, and the row stays `confirmed`.
 */
export async function confirmSubscription(token: string): Promise<ConfirmResult> {
  const { data, error } = await createServiceClient()
    .from("newsletter_subscribers")
    .update({ status: "confirmed", confirm_token_hash: null })
    .eq("confirm_token_hash", hashConfirmToken(token))
    .eq("status", "pending")
    .select("email, locale");
  if (error) {
    console.error(`newsletter: confirm failed (${error.code || "error"})`);
    return { status: "failed" };
  }
  const row = data[0];
  if (!row) return { status: "invalid" };

  await addToAudience(row.email);

  const locale = localeSchema.safeParse(row.locale);
  return { status: "confirmed", locale: locale.success ? locale.data : "ar" };
}
