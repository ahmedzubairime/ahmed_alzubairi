/**
 * The rules every PostHog event passes before it leaves the browser (§9):
 * URLs lose their query string and hash (they can hold a search term, an
 * email or a token), and an event with a property we didn't allow is dropped.
 */

/** Properties that hold a URL or a path. `$set`/`$set_once` copies too. */
export const URL_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$prev_pageview_pathname",
  "$prev_pageview_url",
  "$initial_current_url",
  "$initial_pathname",
  "$initial_referrer",
  "$session_entry_url",
  "$session_entry_pathname",
  "$session_entry_referrer",
] as const;

/**
 * Our own (non-`$`) properties allowed per event. Empty for now: P6A-T06 adds
 * the events of §6.23 and their properties. An event that isn't listed here
 * may carry PostHog's own `$` properties only.
 */
export const EVENT_PROPERTIES: Readonly<Record<string, readonly string[]>> = {};

/** PostHog's own events we keep. Any other `$` event is dropped. */
export const POSTHOG_EVENTS = new Set([
  "$pageview",
  "$pageleave",
  "$exception",
  "$snapshot",
  "$opt_in",
  "$web_vitals",
]);

/**
 * Non-`$` properties the SDK adds itself. `token` and `distinct_id` are kept;
 * `title` (the page title, which on a dashboard page can name a client) is
 * removed rather than dropping the event.
 */
const SDK_KEPT = new Set(["token", "distinct_id"]);
const SDK_REMOVED = new Set(["title"]);

/** The URL without its query string and hash. Text that isn't a URL is kept as it is. */
export function stripUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

type Properties = Record<string, unknown>;

function stripUrls(properties: Properties | undefined): Properties | undefined {
  if (!properties) return properties;
  const copy: Properties = { ...properties };
  for (const key of URL_PROPERTIES) {
    if (key in copy) copy[key] = stripUrl(copy[key]);
  }
  return copy;
}

/** rrweb's Meta record (type 4) carries the page's full `href`. */
function stripSnapshotUrls(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((record: unknown) => {
    if (typeof record !== "object" || record === null) return record;
    const item = record as { type?: unknown; data?: { href?: unknown } };
    if (item.type === 4 && item.data && typeof item.data.href === "string") {
      return { ...item, data: { ...item.data, href: stripUrl(item.data.href) } };
    }
    return record;
  });
}

/** The parts of a PostHog `CaptureResult` these rules read. */
export type AnalyticsEvent = {
  event: string;
  properties?: Properties;
  $set?: Properties;
  $set_once?: Properties;
};

/**
 * The event as it may be sent, or null to drop it. Used as PostHog's
 * `before_send`; it never throws, and drops what it can't read.
 */
export function sanitizeEvent<T extends AnalyticsEvent>(event: T | null): T | null {
  try {
    if (!event || typeof event.event !== "string") return null;
    const name = event.event;
    const allowed = EVENT_PROPERTIES[name];
    if (name.startsWith("$") ? !POSTHOG_EVENTS.has(name) : allowed === undefined) return null;
    const properties = stripUrls(event.properties);
    if (properties) for (const key of SDK_REMOVED) delete properties[key];
    const own = Object.keys(properties ?? {}).filter((key) => !key.startsWith("$") && !SDK_KEPT.has(key));
    if (own.some((key) => !(allowed ?? []).includes(key))) return null;
    if (properties && name === "$snapshot" && "$snapshot_data" in properties) {
      properties.$snapshot_data = stripSnapshotUrls(properties.$snapshot_data);
    }
    return { ...event, properties, $set: stripUrls(event.$set), $set_once: stripUrls(event.$set_once) } as T;
  } catch {
    return null;
  }
}
