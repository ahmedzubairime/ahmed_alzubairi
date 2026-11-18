import type { AnalyticsEventName, AnalyticsEvents } from "./events";
import { eventProperties } from "./events";

type Capturer = { capture: (event: string, properties: Record<string, unknown>) => unknown };

type Queued = { event: string; properties: Record<string, unknown> };

/** Events sent before PostHog has started wait here, up to this many. */
export const MAX_QUEUED = 20;

let instance: Capturer | null = null;
let state: "pending" | "on" | "off" = "pending";
const queue: Queued[] = [];

/** The provider calls this once PostHog is running; queued events go out. */
export function trackerStarted(posthog: Capturer): void {
  instance = posthog;
  state = "on";
  for (const item of queue.splice(0)) posthog.capture(item.event, item.properties);
}

/** The provider calls this when PostHog stays off (no key): nothing is kept. */
export function trackerOff(): void {
  instance = null;
  state = "off";
  queue.length = 0;
}

/** Tests only. */
export function resetTracker(): void {
  instance = null;
  state = "pending";
  queue.length = 0;
}

type Args<Name extends AnalyticsEventName> =
  AnalyticsEvents[Name] extends Record<string, never> ? [properties?: AnalyticsEvents[Name]] : [properties: AnalyticsEvents[Name]];

/**
 * Sends one product event (§6.23). Call it only after the server answered
 * success. The page's language is added as `locale`. An event or property
 * outside `events.ts` is refused here and again by `before_send`. A no-op on
 * the server and when PostHog is off; never throws.
 */
export function track<Name extends AnalyticsEventName>(event: Name, ...[properties]: Args<Name>): void {
  try {
    if (typeof window === "undefined" || state === "off") return;
    const sent = eventProperties(event, properties ?? {}, document.documentElement.lang);
    if (!sent) {
      if (process.env.NODE_ENV !== "production") console.warn(`analytics: refused event ${String(event)}`);
      return;
    }
    if (state === "on" && instance) instance.capture(event, sent);
    else if (queue.length < MAX_QUEUED) queue.push({ event, properties: sent });
  } catch {
    // Analytics never breaks a page.
  }
}
