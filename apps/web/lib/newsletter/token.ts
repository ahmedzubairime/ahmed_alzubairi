import { createHash, randomBytes } from "node:crypto";

/**
 * The double opt-in token (§6.15). The raw token only ever travels in the
 * confirm link; `newsletter_subscribers.confirm_token_hash` holds its SHA-256.
 */

/** A new random token: 32 bytes, safe in a URL. */
export function newConfirmToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashConfirmToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
