// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOT_LOADED, readAuth, resetAuthStateForTests } from "./auth-state";
import { AuthBridge } from "./auth-bridge";

const clerk = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => clerk,
  useUser: () => ({ user: { primaryEmailAddress: { emailAddress: "a@example.com" } } }),
}));

afterEach(() => {
  cleanup();
  resetAuthStateForTests();
});

describe("AuthBridge", () => {
  it("publishes Clerk's state", () => {
    render(<AuthBridge />);
    expect(readAuth()).toEqual({ isLoaded: true, isSignedIn: true, email: "a@example.com" });
  });

  it("keeps the state through re-renders, and drops it once its provider is gone", () => {
    const { rerender, unmount } = render(<AuthBridge />);
    rerender(<AuthBridge />);
    expect(readAuth().isSignedIn).toBe(true);
    unmount();
    expect(readAuth()).toEqual(NOT_LOADED);
  });
});
