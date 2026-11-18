// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), track: vi.fn(), fetch: vi.fn() }));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { update: vi.fn() } }),
  useAuth: () => ({ getToken: vi.fn(async () => "token") }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/analytics/track", () => ({ track: mocks.track }));

const { OnboardingForm } = await import("./onboarding-form");

beforeEach(() => {
  mocks.replace.mockClear();
  mocks.track.mockClear();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show() {
  render(
    <NextIntlClientProvider locale="en" messages={{ Onboarding: en.Onboarding, Errors: en.Errors }}>
      <OnboardingForm destination="/en/account" locale="en" askName={false} />
    </NextIntlClientProvider>,
  );
}

async function send(phone = "0501234567") {
  fireEvent.change(document.querySelector('[name="phone"]')!, { target: { value: phone } });
  const terms = document.querySelector<HTMLInputElement>('[name="terms"]')!;
  if (!terms.checked) fireEvent.click(terms);
  await act(async () => fireEvent.click(document.querySelector('button[type="submit"]')!));
}

const answer = (status: number, body: unknown) =>
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("OnboardingForm analytics", () => {
  it("sends signed_up once when the profile is created, with nothing personal", async () => {
    answer(201, { ok: true });
    show();
    await send();
    expect(mocks.replace).toHaveBeenCalledWith("/en/account");
    expect(mocks.track).toHaveBeenCalledExactlyOnceWith("signed_up");
  });

  it("sends nothing when the profile already existed (409)", async () => {
    answer(409, { error: { code: "conflict", message: "Exists." } });
    show();
    await send();
    expect(mocks.replace).toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });

  it("sends nothing for an invalid phone, a refusal or a network error", async () => {
    show();
    await send("12");
    expect(mocks.fetch).not.toHaveBeenCalled();
    answer(400, { error: { code: "validation_failed", message: "Bad." } });
    await send();
    expect(screen.getByText("Bad.")).toBeTruthy();
    mocks.fetch.mockRejectedValue(new TypeError("offline"));
    await send();
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
