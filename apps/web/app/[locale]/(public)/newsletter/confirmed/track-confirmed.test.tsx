// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { StrictMode, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => `t:${key}` }));
vi.mock("@/components/ui", () => ({ ButtonLink: () => null }));
vi.mock("@/components/public/projects", () => ({ CONTAINER: "" }));

const { TrackConfirmed } = await import("./track-confirmed");
const { default: Page } = await import("./page");

afterEach(() => {
  cleanup();
  track.mockClear();
});

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}

const page = async (status?: string) =>
  Page({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(status ? { status } : {}) });

const text = (tree: ReactNode) =>
  elements(tree)
    .map((element) => (element.props as { children?: unknown }).children)
    .filter((child): child is string => typeof child === "string");
const tracked = (tree: ReactNode) => elements(tree).some((element) => element.type === TrackConfirmed);

describe("newsletter_confirmed", () => {
  it("fires once, under StrictMode's double effects too, then drops the param from the address", () => {
    window.history.replaceState(null, "", "/en/newsletter/confirmed?status=confirmed#top");
    render(
      <StrictMode>
        <TrackConfirmed />
      </StrictMode>,
    );
    expect(track).toHaveBeenCalledExactlyOnceWith("newsletter_confirmed");
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe("/en/newsletter/confirmed#top");
  });

  it("counts only the confirm route's success redirect, not a bare visit, a reload or a refusal", async () => {
    expect(tracked(await page("confirmed"))).toBe(true);
    for (const status of [undefined, "invalid", "retry", "Confirmed"]) {
      expect(tracked(await page(status))).toBe(false);
    }
  });

  it("shows the same success text for status=confirmed and a bare visit", async () => {
    const confirmed = text(await page("confirmed"));
    expect(confirmed).toEqual(text(await page()));
    expect(confirmed).toContain("t:confirm.confirmed.title");
    expect(text(await page("invalid"))).toContain("t:confirm.invalid.title");
  });
});
