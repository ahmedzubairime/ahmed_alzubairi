// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

const state = vi.hoisted(() => ({
  locale: "ar",
  clerk: { loaded: false, signOut: vi.fn() },
}));

vi.mock("@clerk/nextjs", () => ({ useClerk: () => state.clerk }));
vi.mock("next-intl", () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string) => key,
}));

function shell() {
  render(<SignOutButton />);
  return screen.getByRole("button", { name: "signOut" });
}

beforeEach(() => {
  state.locale = "ar";
  state.clerk = { loaded: false, signOut: vi.fn().mockResolvedValue(undefined) };
});
afterEach(cleanup);

describe("SignOutButton", () => {
  it("is shown but disabled until Clerk has loaded, and ignores clicks", () => {
    const button = shell();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.className).toContain("cursor-not-allowed");
    fireEvent.click(button);
    expect(state.clerk.signOut).not.toHaveBeenCalled();
  });

  it("is enabled once Clerk has loaded, with the same size classes", () => {
    const before = shell().className;
    cleanup();
    state.clerk.loaded = true;
    const button = shell();
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    const size = (c: string) => c.split(" ").filter((x) => /^(h-|px-|text-sm|inline-flex)/.test(x));
    expect(size(button.className)).toEqual(size(before));
  });

  it.each([
    ["en", "/en"],
    ["ar", "/ar"],
  ])("sends a member signing out in %s to %s", (locale, home) => {
    state.locale = locale;
    state.clerk.loaded = true;
    fireEvent.click(shell());
    expect(state.clerk.signOut).toHaveBeenCalledWith({ redirectUrl: home });
  });
});
