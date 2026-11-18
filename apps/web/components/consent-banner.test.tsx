// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enConsent from "../messages/en/Consent.json";
import { ConsentBanner } from "./consent-banner";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// jsdom has no layout: the banner's top edge is set by hand, and the
// ResizeObserver callback is kept so a test can fire it.
let bannerTop = 0;
let observed: (() => void) | null = null;

beforeEach(() => {
  bannerTop = window.innerHeight - 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top: bannerTop }) as DOMRect,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observed = callback;
      }
      observe() {}
      disconnect() {
        observed = null;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderBanner(open = true) {
  const onAccept = vi.fn();
  const onDecline = vi.fn();
  const result = render(
    <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
      <ConsentBanner open={open} onAccept={onAccept} onDecline={onDecline} privacyHref="/privacy" />
    </NextIntlClientProvider>,
  );
  const spacer = () => result.container.querySelector<HTMLElement>("[data-consent-spacer]");
  return { onAccept, onDecline, spacer };
}

describe("ConsentBanner spacer", () => {
  it("ends the page with a spacer as tall as the screen space the banner covers", () => {
    const { spacer } = renderBanner();
    expect(spacer()?.style.height).toBe("120px");
    expect(spacer()?.getAttribute("aria-hidden")).toBe("true");
  });

  it("measures again when the banner changes size", () => {
    const { spacer } = renderBanner();
    bannerTop = window.innerHeight - 78;
    act(() => observed?.());
    expect(spacer()?.style.height).toBe("78px");
  });

  it("measures again when the window is resized", () => {
    const { spacer } = renderBanner();
    bannerTop = window.innerHeight - 141;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(spacer()?.style.height).toBe("141px");
  });

  it("leaves no spacer when closed", () => {
    const { spacer } = renderBanner(false);
    expect(spacer()).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("stops observing once closed", () => {
    const view = render(
      <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
        <ConsentBanner open onAccept={() => {}} onDecline={() => {}} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    expect(observed).not.toBeNull();
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
        <ConsentBanner open={false} onAccept={() => {}} onDecline={() => {}} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    expect(observed).toBeNull();
  });
});

describe("ConsentBanner choices", () => {
  it("keeps accept and decline equal and in Tab order after the privacy link", () => {
    const { onAccept, onDecline } = renderBanner();
    const region = screen.getByRole("region", { name: "Cookies" });
    const focusable = [...region.querySelectorAll<HTMLElement>("a, button")];
    expect(focusable.map((element) => element.textContent)).toEqual(["Privacy policy", "Accept", "Decline"]);
    expect(focusable.every((element) => element.tabIndex >= 0)).toBe(true);
    expect(focusable[1].className).toBe(focusable[2].className);
    fireEvent.click(focusable[1]);
    fireEvent.click(focusable[2]);
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
