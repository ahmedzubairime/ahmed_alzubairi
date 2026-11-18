import { describe, expect, it, vi } from "vitest";
import { applyConsent, fetchPosthogConfig, persistenceFor, posthogOptions, syncRecording, type PosthogLike } from "./client";

const CONFIG = { key: "phc_1", host: "https://eu.i.posthog.com" };

function fake(persistence: string, recording = false) {
  const state = { persistence, recording };
  const posthog: PosthogLike & { set_config: ReturnType<typeof vi.fn> } = {
    set_config: vi.fn((config: { persistence?: string }) => {
      if (config.persistence) state.persistence = config.persistence;
    }),
    get_config: (() => state.persistence) as PosthogLike["get_config"],
    startSessionRecording: vi.fn(() => {
      state.recording = true;
    }),
    stopSessionRecording: vi.fn(() => {
      state.recording = false;
    }),
    sessionRecordingStarted: () => state.recording,
  };
  return { posthog, state };
}

describe("posthogOptions", () => {
  it("keeps PostHog in memory before any choice and after decline", () => {
    expect(posthogOptions(CONFIG, null).persistence).toBe("memory");
    expect(posthogOptions(CONFIG, "denied").persistence).toBe("memory");
    expect(posthogOptions(CONFIG, "granted").persistence).toBe("localStorage+cookie");
  });

  it("follows the privacy rules", () => {
    const options = posthogOptions(CONFIG, null);
    expect(options).toMatchObject({
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      autocapture: false,
      rageclick: false,
      capture_dead_clicks: false,
      capture_pageview: "history_change",
      person_profiles: "identified_only",
      disable_session_recording: true,
      session_recording: { maskAllInputs: true, maskTextSelector: "form" },
      capture_exceptions: true,
    });
    const send = options.before_send as (event: unknown) => unknown;
    expect(send({ event: "$pageview", properties: { $current_url: "https://x.test/en?q=1" } })).toMatchObject({
      properties: { $current_url: "https://x.test/en" },
    });
  });
});

describe("applyConsent", () => {
  it("moves to cookie + localStorage on accept", () => {
    const { posthog, state } = fake("memory");
    applyConsent(posthog, "granted");
    expect(state.persistence).toBe("localStorage+cookie");
  });

  it("stays in memory on decline, with no config change", () => {
    const { posthog } = fake("memory");
    applyConsent(posthog, "denied");
    expect(posthog.set_config).not.toHaveBeenCalled();
    expect(persistenceFor("denied")).toBe("memory");
  });
});

describe("syncRecording", () => {
  it("starts on a public page and stops on the account and dashboard, in one session", () => {
    const { posthog, state } = fake("memory");
    syncRecording(posthog, "/ar/services");
    expect(state.recording).toBe(true);
    syncRecording(posthog, "/ar/account");
    expect(state.recording).toBe(false);
    syncRecording(posthog, "/ar/dashboard");
    expect(posthog.startSessionRecording).toHaveBeenCalledTimes(1);
    syncRecording(posthog, "/en/about");
    expect(state.recording).toBe(true);
  });

  it("never starts on a private page", () => {
    const { posthog } = fake("memory");
    for (const path of ["/ar/account", "/en/dashboard/messages", "/ar/sign-in", "/en/sign-up", "/ar/onboarding"]) {
      syncRecording(posthog, path);
    }
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
  });
});

describe("fetchPosthogConfig", () => {
  it("reads the key and host", async () => {
    const fetcher = vi.fn(async () => Response.json(CONFIG));
    expect(await fetchPosthogConfig(fetcher as unknown as typeof fetch)).toEqual(CONFIG);
    expect(fetcher).toHaveBeenCalledWith("/api/posthog-config");
  });

  it("is null on 404, a bad body or a network error", async () => {
    const off = async () => Response.json({ error: { code: "not_found", message: "off" } }, { status: 404 });
    const bad = async () => Response.json({ key: "", host: "nope" });
    const down = async () => {
      throw new TypeError("Failed to fetch");
    };
    for (const fetcher of [off, bad, down]) {
      expect(await fetchPosthogConfig(fetcher as unknown as typeof fetch)).toBeNull();
    }
  });
});
