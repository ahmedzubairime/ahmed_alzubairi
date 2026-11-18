import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NOT_LOADED,
  onClerkRequest,
  publishAuth,
  readAuth,
  requestClerk,
  resetAuthStateForTests,
  whenClerkLoaded,
} from "./auth-state";

afterEach(resetAuthStateForTests);

describe("auth state", () => {
  it("starts signed out and not loaded", () => {
    expect(readAuth()).toEqual(NOT_LOADED);
  });

  it("passes a request made before the loader listens", () => {
    requestClerk();
    const start = vi.fn();
    onClerkRequest(start);
    expect(start).toHaveBeenCalledOnce();
  });

  it("asks for Clerk no more once it has loaded", () => {
    const start = vi.fn();
    onClerkRequest(start);
    publishAuth({ isLoaded: true, isSignedIn: false, email: null });
    requestClerk();
    expect(start).not.toHaveBeenCalled();
  });

  it("waits for Clerk, asking for it, then resolves with the state", async () => {
    const start = vi.fn();
    onClerkRequest(start);
    const pending = whenClerkLoaded();
    expect(start).toHaveBeenCalledOnce();
    publishAuth({ isLoaded: true, isSignedIn: true, email: "a@example.com" });
    await expect(pending).resolves.toEqual({ isLoaded: true, isSignedIn: true, email: "a@example.com" });
  });

  it("resolves at once when Clerk is already loaded", async () => {
    publishAuth({ isLoaded: true, isSignedIn: false, email: null });
    await expect(whenClerkLoaded()).resolves.toMatchObject({ isSignedIn: false });
  });
});
