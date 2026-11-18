// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Consent.json";
import en from "@/messages/en/Consent.json";
import { CONSENT_EVENT } from "@/lib/analytics/consent";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ConsentChoice } = await import("./consent-choice");

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  localStorage.clear();
});

const tree = (locale: "ar" | "en" = "en") => (
  <NextIntlClientProvider locale={locale} messages={{ Consent: locale === "ar" ? ar : en }}>
    <ConsentChoice />
  </NextIntlClientProvider>
);

describe("ConsentChoice", () => {
  it("is in the server HTML, so it paints with the page, followed by its hide script", () => {
    const html = renderToString(tree());
    expect(html).toContain(`aria-label="${en.label}"`);
    expect(html).toContain("<script>");
    expect(html.indexOf("data-consent-banner")).toBeLessThan(html.indexOf("<script>"));
  });

  // The server HTML as the browser parses it: the script runs right after the banner.
  const parseServerHtml = () => {
    document.body.innerHTML = renderToString(tree());
    const script = document.body.querySelector("script")!;
    Object.defineProperty(document, "currentScript", { configurable: true, value: script });
    try {
      new Function(script.textContent ?? "")();
    } finally {
      Object.defineProperty(document, "currentScript", { configurable: true, value: null });
    }
    return document.body.querySelector<HTMLElement>("[data-consent-banner]")!;
  };

  it.each(["granted", "denied"])("hides before the first paint when the choice (%s) is stored", (choice) => {
    localStorage.setItem("consent", choice);
    expect(parseServerHtml().hidden).toBe(true);
  });

  it("shows the banner again when the choice is cleared between the script and hydration", async () => {
    localStorage.setItem("consent", "denied");
    const wrapper = parseServerHtml();
    expect(wrapper.hidden).toBe(true);
    localStorage.removeItem("consent"); // another tab cleared it
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(document.body, tree());
    });
    expect(wrapper.hidden).toBe(false);
    expect(screen.getByRole("region", { name: en.label })).toBeTruthy();
    act(() => root.unmount());
  });

  it("keeps a script-hidden banner hidden after hydration while the choice is stored", async () => {
    localStorage.setItem("consent", "granted");
    const wrapper = parseServerHtml();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(document.body, tree());
    });
    expect(wrapper.hidden).toBe(true);
    expect(screen.queryByRole("region")).toBeNull();
    act(() => root.unmount());
  });

  it("renders no script in a client render, where it would never run", () => {
    const { container } = render(tree());
    expect(container.querySelector("script")).toBeNull();
  });

  it("stays visible before hydration for a visitor who hasn't chosen", () => {
    expect(parseServerHtml().hidden).toBe(false);
  });

  it("shows the banner until a choice, with the privacy link", () => {
    render(tree());
    expect(screen.getByRole("region", { name: en.label })).toBeTruthy();
    expect(screen.getByRole("link", { name: en.privacy }).getAttribute("href")).toBe("/privacy");
  });

  it("declines in one click: saved, announced, gone", () => {
    const heard = vi.fn();
    window.addEventListener(CONSENT_EVENT, (event) => heard((event as CustomEvent).detail));
    render(tree());
    act(() => fireEvent.click(screen.getByRole("button", { name: en.decline })));
    expect(localStorage.getItem("consent")).toBe("denied");
    expect(heard).toHaveBeenCalledWith("denied");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("accepts", () => {
    render(tree());
    act(() => fireEvent.click(screen.getByRole("button", { name: en.accept })));
    expect(localStorage.getItem("consent")).toBe("granted");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("stays hidden once a choice is stored", () => {
    localStorage.setItem("consent", "denied");
    render(tree());
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("closes even when storage is blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    render(tree("ar"));
    act(() => fireEvent.click(screen.getByRole("button", { name: ar.decline })));
    expect(screen.queryByRole("region")).toBeNull();
    spy.mockRestore();
  });
});
