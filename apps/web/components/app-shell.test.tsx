// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const state = vi.hoisted(() => ({ locale: "ar", redirectUrl: undefined as string | undefined }));

vi.mock("@clerk/nextjs", () => ({
  SignOutButton: ({ redirectUrl, children }: { redirectUrl?: string; children: ReactNode }) => {
    state.redirectUrl = redirectUrl;
    return children;
  },
}));
vi.mock("next-intl", () => ({
  useLocale: () => state.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("./compact-header", () => ({ CompactHeader: ({ children }: { children: ReactNode }) => children }));
vi.mock("./nav-link", () => ({ NavLink: ({ children }: { children: ReactNode }) => children }));
vi.mock("./skip-link", () => ({ MAIN_CONTENT_ID: "main", SkipLink: () => null }));

afterEach(() => {
  cleanup();
  state.redirectUrl = undefined;
});

describe("AppShell sign-out", () => {
  it.each([
    ["en", "/en"],
    ["ar", "/ar"],
  ])("sends a member signing out in %s to %s", (locale, home) => {
    state.locale = locale;
    render(
      <AppShell title="t" navLabel="n" links={[]}>
        <p>content</p>
      </AppShell>,
    );
    expect(state.redirectUrl).toBe(home);
  });
});
