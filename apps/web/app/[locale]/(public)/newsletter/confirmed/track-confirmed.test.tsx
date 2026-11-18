// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { StrictMode, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/track", () => ({ track }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
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

describe("newsletter_confirmed", () => {
  it("fires once per load, even under StrictMode's double effects", () => {
    render(
      <StrictMode>
        <TrackConfirmed />
      </StrictMode>,
    );
    expect(track).toHaveBeenCalledExactlyOnceWith("newsletter_confirmed");
  });

  it("is mounted only when the route said confirmed", async () => {
    expect(elements(await page()).some((element) => element.type === TrackConfirmed)).toBe(true);
    for (const status of ["invalid", "retry"]) {
      expect(elements(await page(status)).some((element) => element.type === TrackConfirmed)).toBe(false);
    }
  });
});
