// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// jsdom has no layout: the banner's top edge is set by hand. The
// ResizeObserver mock keeps its callback and the element it observes, so a
// test can check what is observed and fire the callback.
let bannerTop = 0;
let observed: (() => void) | null = null;
let observedTarget: Element | null = null;

beforeEach(() => {
  bannerTop = window.innerHeight - 120;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ top: bannerTop }) as DOMRect,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
      }
      observe(target: Element) {
        observedTarget = target;
        observed = this.callback;
      }
      disconnect() {
        observed = null;
        observedTarget = null;
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
    expect(observedTarget).toBe(screen.getByRole("region", { name: "Cookies" }));
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
    expect(observedTarget).toBe(screen.getByRole("region", { name: "Cookies" }));
    view.rerender(
      <NextIntlClientProvider locale="en" messages={{ Consent: enConsent }}>
        <ConsentBanner open={false} onAccept={() => {}} onDecline={() => {}} privacyHref="/privacy" />
      </NextIntlClientProvider>,
    );
    expect(observed).toBeNull();
    expect(observedTarget).toBeNull();
  });
});

describe("ConsentBanner choices", () => {
  it("is reached by Tab: privacy link, then accept, then decline", async () => {
    const user = userEvent.setup();
    renderBanner();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Privacy policy" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Accept" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Decline" }));
  });

  it("keeps accept and decline equal, and calls their handlers", () => {
    const { onAccept, onDecline } = renderBanner();
    const accept = screen.getByRole("button", { name: "Accept" });
    const decline = screen.getByRole("button", { name: "Decline" });
    expect(accept.className).toBe(decline.className);
    fireEvent.click(accept);
    fireEvent.click(decline);
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });
});
