import type { ErrorCode, ErrorResponse, Locale } from "@repo/shared";
import ar from "@/messages/ar/ResourceErrors.json";
import en from "@/messages/en/ResourceErrors.json";

const MESSAGES = { ar, en };

/** A route's answer: its status and body. */
export type Result<T> = { status: number; body: T | ErrorResponse };

export type Failure = { status: number; body: ErrorResponse };

/** Each refusal: its error code, HTTP status and `ResourceErrors` message. */
const FAILURES = {
  invalid: ["validation_failed", 400],
  emailRequired: ["validation_failed", 400],
  emailInvalid: ["validation_failed", 400],
  notFound: ["not_found", 404],
  rateLimited: ["rate_limited", 429],
  denied: ["forbidden", 403],
  internal: ["internal_error", 500],
} as const satisfies Record<keyof typeof en, readonly [ErrorCode, number]>;

export type FailureKey = keyof typeof FAILURES;

export function fail(key: FailureKey, locale: Locale): Failure {
  const [code, status] = FAILURES[key];
  return { status, body: { error: { code, message: MESSAGES[locale][key] } } };
}
