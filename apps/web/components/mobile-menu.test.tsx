// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileMenu } from "./mobile-menu";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("./nav-link", () => ({
  NavLink: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

describe("MobileMenu", () => {
  it("opens and closes from its button", () => {
    render(<MobileMenu />);
    const button = screen.getByRole("button", { name: "openMenu" });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "home" })).toBeTruthy();
  });

  it("closes on Escape and gives focus back to its button", () => {
    render(<MobileMenu />);
    fireEvent.click(screen.getByRole("button", { name: "openMenu" }));
    screen.getByRole("link", { name: "home" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    const button = screen.getByRole("button", { name: "openMenu" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });
});
