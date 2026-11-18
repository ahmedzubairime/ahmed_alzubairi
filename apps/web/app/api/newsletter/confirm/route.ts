import { newsletterConfirmQuerySchema, type Locale } from "@repo/shared";
import { connection, NextResponse, type NextRequest } from "next/server";
import { protectForm, type FormLimit } from "@/lib/arcjet";
import { confirmSubscription } from "@/lib/newsletter/confirm";

/** Twenty opens per IP every ten minutes: a guessed token never gets far. */
export const NEWSLETTER_CONFIRM_LIMIT: FormLimit = {
  route: "newsletter-confirm",
  window: "10m",
  max: 20,
};

export type ConfirmPageStatus = "confirmed" | "invalid" | "retry";

/**
 * The link comes from an email, so there is no page to take the language
 * from. A confirmed row gives its own; otherwise the browser's first language
 * decides, and Arabic is the default.
 */
function browserLocale(request: NextRequest): Locale {
  const first = request.headers.get("accept-language")?.split(",")[0]?.trim().toLowerCase();
  return first === "en" || first?.startsWith("en-") ? "en" : "ar";
}

function toPage(request: NextRequest, locale: Locale, status?: ConfirmPageStatus) {
  const url = new URL(`/${locale}/newsletter/confirmed`, request.url);
  if (status) url.searchParams.set("status", status);
  // 303: the result page is always fetched with GET, and never cached.
  const response = NextResponse.redirect(url, 303);
  response.headers.set("cache-control", "no-store");
  // The token is in this URL: it must not travel on as a referrer.
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}

/**
 * `GET /api/newsletter/confirm?token=` (§6.15): the link in the confirm email.
 * A good token confirms the subscription once and lands on the confirmed
 * page; a wrong or used one lands on the same page with `status=invalid`. The
 * token is never logged.
 *
 * Arcjet runs first. A refused request (a link scanner, too many tries)
 * changes nothing: the token still works, and the page says to try again.
 */
export async function GET(request: NextRequest) {
  // Always on request: the build must never run this.
  await connection();
  const decision = await protectForm(request, NEWSLETTER_CONFIRM_LIMIT);
  if (decision !== "allow") return toPage(request, browserLocale(request), "retry");

  const parsed = newsletterConfirmQuerySchema.safeParse({
    token: request.nextUrl.searchParams.get("token") ?? "",
  });
  if (!parsed.success) return toPage(request, browserLocale(request), "invalid");

  const result = await confirmSubscription(parsed.data.token);
  // `confirmed` only on this redirect: the page counts it once for analytics
  // and drops the param, so a reload or a bare visit isn't another confirm.
  if (result.status === "confirmed") return toPage(request, result.locale, "confirmed");
  return toPage(
    request,
    browserLocale(request),
    result.status === "failed" ? "retry" : "invalid",
  );
}
