// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/Newsletter.json";
import en from "@/messages/en/Newsletter.json";
import { NewsletterSignup } from "./newsletter-signup";

const fetchMock = vi.fn();
const MESSAGES = { ar, en };

function show(locale: "ar" | "en" = "en", source: "footer" | "home" | "blog" = "footer") {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ Newsletter: MESSAGES[locale] }}>
      <NewsletterSignup source={source} />
    </NextIntlClientProvider>,
  );
}

const field = () => screen.getByRole("textbox") as HTMLInputElement;
function submit(value: string) {
  fireEvent.change(field(), { target: { value } });
  fireEvent.submit(field().closest("form")!);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NewsletterSignup", () => {
  it.each(["ar", "en"] as const)("shows a labelled email field and a button in %s", (locale) => {
    show(locale);
    expect(screen.getByRole("heading", { name: MESSAGES[locale].title })).toBeTruthy();
    expect(screen.getByLabelText(MESSAGES[locale].email)).toBe(field());
    // An address reads left to right in both languages.
    expect(field().dir).toBe("ltr");
    expect(screen.getByRole("button", { name: MESSAGES[locale].subscribe })).toBeTruthy();
  });

  it("sends the email, the page's language and the source, then shows the one fixed text", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    show("ar", "blog");
    submit("  reader@example.com ");
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(ar.done));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/newsletter/subscribe");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "reader@example.com",
      locale: "ar",
      source: "blog",
    });
    // The form is gone, and the text never says whether the address was known.
    expect(screen.queryByRole("textbox")).toBeNull();
    // Focus moves in an effect, after the text is already on screen.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("status")));
  });

  it.each([
    ["", en.required],
    ["not-an-email", en.emailInvalid],
  ])("checks %j before sending", (value, message) => {
    show();
    submit(value);
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(field().getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message on a refusal and keeps what was typed", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate_limited", message: en.errors.rate_limited } }), {
        status: 429,
      }),
    );
    show();
    submit("reader@example.com");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.errors.rate_limited));
    expect(field().value).toBe("reader@example.com");
  });

  it("shows its own text when the answer is unreadable or the network fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    show();
    submit("reader@example.com");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.errors.internal_error));
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fireEvent.submit(field().closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.networkError));
  });

  it("has the same keys in both languages", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? keys(inner as object, `${prefix}${key}.`) : `${prefix}${key}`,
      );
    expect(keys(ar)).toEqual(keys(en));
  });
});
