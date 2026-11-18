// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { requestClerk, resetAuthStateForTests } from "./auth-state";
import { LazyClerk } from "./lazy-clerk";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));
// The chunk fails to download.
vi.mock("./public-clerk", () => {
  throw new Error("chunk failed");
});

afterEach(() => {
  cleanup();
  resetAuthStateForTests();
});

describe("LazyClerk when Clerk's chunk fails", () => {
  it("renders nothing and leaves the page alone", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <main>
        <p>Public content</p>
        <LazyClerk />
      </main>,
    );
    await act(async () => {
      requestClerk();
      await vi.dynamicImportSettled();
    });
    expect(screen.getByText("Public content")).toBeTruthy();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
