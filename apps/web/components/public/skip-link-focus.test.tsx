// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkipLinkFocus } from "./skip-link-focus";

afterEach(cleanup);

describe("SkipLinkFocus", () => {
  it("moves focus to the target when the skip link is used, without adding it to the Tab order", () => {
    const { getByText, container } = render(
      <>
        <SkipLinkFocus targetId="main-content" />
        <a href="#main-content">Skip</a>
        <main id="main-content">Content</main>
      </>,
    );
    fireEvent.click(getByText("Skip"));
    const main = container.querySelector("main")!;
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("leaves other links alone", () => {
    const { getByText } = render(
      <>
        <SkipLinkFocus targetId="main-content" />
        <a href="#elsewhere">Other</a>
        <main id="main-content">Content</main>
      </>,
    );
    fireEvent.click(getByText("Other"));
    expect(document.activeElement).toBe(document.body);
  });
});
