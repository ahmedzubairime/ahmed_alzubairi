// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
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
  localStorage.clear();
});

const tree = (locale: "ar" | "en" = "en") => (
  <NextIntlClientProvider locale={locale} messages={{ Consent: locale === "ar" ? ar : en }}>
    <ConsentChoice />
  </NextIntlClientProvider>
);

describe("ConsentChoice", () => {
  it("renders nothing on the server: the choice is read in the browser only", () => {
    expect(renderToString(tree())).toBe("");
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
