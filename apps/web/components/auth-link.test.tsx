// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { onClerkRequest, publishAuth, resetAuthStateForTests } from "@/components/clerk/auth-state";
import { AuthLink } from "./auth-link";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  resetAuthStateForTests();
});

describe("AuthLink", () => {
  it("links to sign-in before Clerk loads: the safe choice for everyone", () => {
    render(<AuthLink />);
    expect(screen.getByRole("link", { name: "signIn" }).getAttribute("href")).toBe("/sign-in");
  });

  it("links to sign-in when signed out", () => {
    render(<AuthLink />);
    act(() => publishAuth({ isLoaded: true, isSignedIn: false, email: null }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/sign-in");
  });

  it("switches to the account once Clerk says the visitor is signed in", () => {
    render(<AuthLink />);
    act(() => publishAuth({ isLoaded: true, isSignedIn: true, email: "a@example.com" }));
    expect(screen.getByRole("link", { name: "account" }).getAttribute("href")).toBe("/account");
  });

  it("asks for Clerk when pointed at or focused", () => {
    const requested = vi.fn();
    onClerkRequest(requested);
    render(<AuthLink />);
    fireEvent.pointerEnter(screen.getByRole("link"));
    fireEvent.focus(screen.getByRole("link"));
    expect(requested).toHaveBeenCalledTimes(2);
  });
});
