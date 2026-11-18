import { posthogConfigResponseSchema, type PosthogConfigResponse } from "@repo/shared";
import type { PostHogConfig } from "posthog-js";
import type { Consent } from "./consent";
import { uiHost } from "./env";
import { replayAllowed } from "./replay";
import { maskAttribute, sanitizeEvent, stripUrl } from "./sanitize";

/** Same-origin path that next.config.ts rewrites to PostHog EU. */
export const INGEST_PATH = "/ingest";

/** The cookie and storage mode for a consent choice (§6.25). */
export function persistenceFor(consent: Consent | null): PostHogConfig["persistence"] {
  return consent === "granted" ? "localStorage+cookie" : "memory";
}

/**
 * PostHog's settings (§6.23, §9). Memory only until the visitor accepts; no
 * autocapture or click capture (element text can hold names); no person
 * profiles; replay off until a public page turns it on; every event through
 * `sanitizeEvent`.
 */
export function posthogOptions(config: PosthogConfigResponse, consent: Consent | null): Partial<PostHogConfig> {
  return {
    api_host: INGEST_PATH,
    ui_host: uiHost(config.host),
    defaults: "2026-08-30",
    persistence: persistenceFor(consent),
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    enable_heatmaps: false,
    capture_pageview: "history_change",
    person_profiles: "identified_only",
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "form",
      // Links, images and forms in the page: no query or hash in replay.
      maskAttributeFn: maskAttribute,
      // Recorded network requests: the address without its query.
      maskCapturedNetworkRequestFn: (request) => ({ ...request, name: stripUrl(request.name) as string }),
    },
    capture_exceptions: true,
    disable_surveys: true,
    before_send: (event) => sanitizeEvent(event),
  };
}

/** The parts of the PostHog instance the rules below use. */
export type PosthogLike = {
  set_config: (config: Partial<PostHogConfig>) => void;
  get_config?: (key: "persistence") => PostHogConfig["persistence"];
  startSessionRecording: () => void;
  stopSessionRecording: () => void;
  sessionRecordingStarted: () => boolean;
};

/** Accept moves PostHog to cookie + localStorage; decline keeps it in memory. */
export function applyConsent(posthog: PosthogLike, consent: Consent): void {
  const persistence = persistenceFor(consent);
  if (posthog.get_config?.("persistence") !== persistence) posthog.set_config({ persistence });
}

/**
 * Records on public pages only. On any other page it always calls stop, even
 * when nothing records yet: a start still loading the recorder would
 * otherwise begin on the private page.
 */
export function syncRecording(posthog: PosthogLike, pathname: string): void {
  if (!replayAllowed(pathname)) {
    posthog.stopSessionRecording();
    return;
  }
  if (!posthog.sessionRecordingStarted()) posthog.startSessionRecording();
}

/**
 * The key and host from `GET /api/posthog-config`, or null when PostHog is
 * off (204) or the answer can't be used. Never throws.
 */
export async function fetchPosthogConfig(fetcher: typeof fetch = fetch): Promise<PosthogConfigResponse | null> {
  try {
    const response = await fetcher("/api/posthog-config");
    // 200 carries the config; 204 means PostHog is off.
    if (response.status !== 200) return null;
    const parsed = posthogConfigResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
