import "server-only";
import arcjet, { detectBot, fixedWindow, shield, validateEmail } from "@arcjet/next";

/**
 * Arcjet for public forms and download gates (§3 Security, §9). Every route
 * gets Shield and bot detection, plus its own fixed-window rate limit keyed by
 * route and IP. It fails open: a missing key, an Arcjet error or a timeout lets
 * the request through and is logged.
 */

/** A route's rate limit. `route` keys the counter, so routes never share one. */
export type FormLimit = {
  route: string;
  /** Arcjet duration, e.g. `"10m"`. */
  window: string;
  max: number;
};

export type FormDecision = "allow" | "rate_limited" | "denied";

function createBase(key: string) {
  return arcjet({
    key,
    rules: [
      shield({ mode: "LIVE" }),
      // An empty allow list refuses every detected bot. Forms have no bot to let in.
      detectBot({ mode: "LIVE", allow: [] }),
    ],
  });
}

function withLimit(base: ReturnType<typeof createBase>, limit: FormLimit) {
  return base.withRule(
    fixedWindow({
      mode: "LIVE",
      characteristics: ["ip.src", "route"],
      window: limit.window,
      max: limit.max,
    }),
  );
}

// Created on first use, not at import: the build never needs ARCJET_KEY.
let base: ReturnType<typeof createBase> | null | undefined;
const routeClients = new Map<string, ReturnType<typeof withLimit>>();

function clientFor(limit: FormLimit) {
  if (base === undefined) {
    const key = process.env.ARCJET_KEY;
    base = key ? createBase(key) : null;
  }
  if (!base) return null;
  let client = routeClients.get(limit.route);
  if (!client) {
    client = withLimit(base, limit);
    routeClients.set(limit.route, client);
  }
  return client;
}

/** Call once per request, before reading the body. */
export async function protectForm(request: Request, limit: FormLimit): Promise<FormDecision> {
  try {
    const client = clientFor(limit);
    if (!client) {
      console.error(`[arcjet] ${limit.route}: ARCJET_KEY is not set, request allowed`);
      return "allow";
    }
    const decision = await client.protect(request, { route: limit.route });
    if (decision.isErrored()) {
      console.error(`[arcjet] ${limit.route}: decision errored, request allowed:`, decision.reason.message);
      return "allow";
    }
    if (decision.isDenied()) {
      return decision.reason.isRateLimit() ? "rate_limited" : "denied";
    }
    return "allow";
  } catch (error) {
    console.error(`[arcjet] ${limit.route}: protect failed, request allowed:`, error);
    return "allow";
  }
}

function createEmailClient(key: string) {
  return arcjet({
    key,
    rules: [validateEmail({ mode: "LIVE", deny: ["DISPOSABLE", "INVALID", "NO_MX_RECORDS"] })],
  });
}

let emailClient: ReturnType<typeof createEmailClient> | null | undefined;

/**
 * True unless Arcjet refuses the address: disposable, invalid, or a domain
 * with no mail server. Call it after `protectForm`, once the body is parsed.
 * `route` names the caller in the log. It fails open like `protectForm`, and
 * never logs the address.
 */
export async function validateFormEmail(
  request: Request,
  email: string,
  route: string,
): Promise<boolean> {
  try {
    if (emailClient === undefined) {
      const key = process.env.ARCJET_KEY;
      emailClient = key ? createEmailClient(key) : null;
    }
    if (!emailClient) {
      console.error(`[arcjet] ${route}: ARCJET_KEY is not set, email accepted`);
      return true;
    }
    const decision = await emailClient.protect(request, { email });
    if (decision.isErrored()) {
      console.error(`[arcjet] ${route}: email decision errored, email accepted:`, decision.reason.message);
      return true;
    }
    return !(decision.isDenied() && decision.reason.isEmail());
  } catch (error) {
    console.error(`[arcjet] ${route}: email check failed, email accepted:`, error);
    return true;
  }
}

/** Test seam: forget the cached clients so a test can change ARCJET_KEY. */
export function resetArcjetClients() {
  base = undefined;
  emailClient = undefined;
  routeClients.clear();
}
