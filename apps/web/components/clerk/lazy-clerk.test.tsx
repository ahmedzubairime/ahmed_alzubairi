// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestClerk, resetAuthStateForTests } from "./auth-state";
import { IDLE_TIMEOUT_MS, LazyClerk } from "./lazy-clerk";

vi.mock("next-intl", () => ({ useLocale: () => "ar" }));
vi.mock("./public-clerk", () => ({
  default: (props: { signInUrl: string; signUpUrl: string; afterSignOutUrl: string }) => (
    <p data-testid="clerk">{JSON.stringify(props)}</p>
  ),
}));

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no idle callback: the loader falls back to its timeout.
  Reflect.deleteProperty(window, "requestIdleCallback");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetAuthStateForTests();
});

const loaded = async () => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  return screen.queryByTestId("clerk");
};

describe("LazyClerk", () => {
  it("loads nothing with the page", async () => {
    render(<LazyClerk />);
    expect(await loaded()).toBeNull();
  });

  it("loads Clerk once the page is idle, with the locale's URLs", async () => {
    render(<LazyClerk />);
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS));
    const clerk = await loaded();
    expect(JSON.parse(clerk!.textContent!)).toEqual({
      signInUrl: "/ar/sign-in",
      signUpUrl: "/ar/sign-up",
      afterSignOutUrl: "/ar",
    });
  });

  it("loads Clerk on the first interaction", async () => {
    render(<LazyClerk />);
    act(() => window.dispatchEvent(new Event("pointerdown")));
    expect(await loaded()).not.toBeNull();
  });

  it("loads Clerk when an auth-aware control asks", async () => {
    render(<LazyClerk />);
    act(() => requestClerk());
    expect(await loaded()).not.toBeNull();
  });
});
