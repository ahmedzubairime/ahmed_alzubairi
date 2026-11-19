// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("./sign-out-button", () => ({ SignOutButton: () => <button type="button">sign-out</button> }));
vi.mock("./compact-header", () => ({
  CompactHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));
vi.mock("./nav-link", () => ({ NavLink: ({ children }: { children: ReactNode }) => children }));
vi.mock("./skip-link", () => ({ MAIN_CONTENT_ID: "main", SkipLink: () => null }));

afterEach(cleanup);

describe("AppShell", () => {
  it("puts the sign-out button in the header", () => {
    render(
      <AppShell title="t" navLabel="n" links={[]}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner").textContent).toContain("sign-out");
    expect(screen.getByRole("main").textContent).toBe("content");
  });
});
