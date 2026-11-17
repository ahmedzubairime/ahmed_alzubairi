// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAIN_NAV } from "./nav-items";

vi.mock("next-intl", async (original) => ({
  ...(await original<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/content", () => ({ getSiteSettings: async () => null }));
vi.mock("./auth-link", () => ({ AuthLink: () => null }));
vi.mock("./consultation-button", () => ({ ConsultationButton: () => <button type="button">consult</button> }));
vi.mock("./language-switch", () => ({ LanguageSwitch: () => null }));
vi.mock("./theme-switch", () => ({ ThemeSwitch: () => null }));
vi.mock("./site-logo", () => ({ SiteLogo: () => <span>logo</span> }));
vi.mock("./nav-link", () => ({
  NavLink: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const { SiteHeader } = await import("./site-header");

afterEach(cleanup);

/** The responsive classes on an element, e.g. ["hidden", "2xl:block"]. */
const classes = (element: Element | null) => (element?.getAttribute("class") ?? "").split(/\s+/);

describe("SiteHeader breakpoints", () => {
  it("shows the inline nav only from 2xl, where the menu button hides", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    const [inline] = within(header).getAllByRole("navigation", { name: "mainLabel" });
    expect(classes(inline)).toEqual(expect.arrayContaining(["hidden", "2xl:block"]));
    expect(classes(inline).some((name) => name.startsWith("xl:"))).toBe(false);

    const menuButton = within(header).getByRole("button", { name: "openMenu" });
    expect(classes(menuButton.parentElement)).toContain("2xl:hidden");
  });

  it("lets the row grow to the 2xl width, so the inline nav fits on one line", () => {
    render(<SiteHeader />);
    const row = screen.getByRole("banner").firstElementChild;
    expect(classes(row)).toEqual(expect.arrayContaining(["max-w-7xl", "2xl:max-w-(--breakpoint-2xl)"]));
  });

  it("lists every link in both the inline nav and the menu", () => {
    render(<SiteHeader />);
    const header = screen.getByRole("banner");
    // The menu panel is hidden until opened; its links are there either way.
    const navs = within(header).getAllByRole("navigation", { name: "mainLabel", hidden: true });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const hrefs = within(nav)
        .getAllByRole("link", { hidden: true })
        .map((link) => link.getAttribute("href"));
      expect(hrefs).toEqual(MAIN_NAV.map((item) => item.href));
    }
  });
});
