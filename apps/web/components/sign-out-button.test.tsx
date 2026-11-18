// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./sign-out-button";

type Listener = (status: string) => void;
type FakeClerk = {
  loaded: boolean;
  signOut: ReturnType<typeof vi.fn>;
  listeners: Set<Listener>;
  on: (event: string, listener: Listener) => void;
  off: (event: string, listener: Listener) => void;
};
function fakeClerk(loaded: boolean): FakeClerk {
  const listeners = new Set<Listener>();
  return {
    loaded,
    signOut: vi.fn().mockResolvedValue(undefined),
    listeners,
    on: (_event, listener) => listeners.add(listener),
    off: (_event, listener) => listeners.delete(listener),
  };
}

const state = vi.hoisted(() => ({ locale: "ar", clerk: null as unknown as FakeClerk }));

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
  state.clerk = fakeClerk(false);
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

  // After a client navigation from sign-in, Clerk can finish loading without
  // the provider re-rendering: the button must still follow Clerk's status.
  it("enables itself when Clerk reports it has loaded, without a re-render from above", () => {
    const button = shell();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    act(() => {
      state.clerk.loaded = true;
      for (const listener of state.clerk.listeners) listener("ready");
    });
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    fireEvent.click(button);
    expect(state.clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/ar" });
  });

  it("stops listening when it unmounts", () => {
    shell();
    expect(state.clerk.listeners.size).toBe(1);
    cleanup();
    expect(state.clerk.listeners.size).toBe(0);
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
