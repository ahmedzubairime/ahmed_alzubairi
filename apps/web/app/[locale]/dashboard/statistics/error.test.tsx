// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", async (original) => ({ ...(await original<typeof import("next/navigation")>()), useRouter: () => ({ refresh }) }));

const { default: StatisticsError } = await import("./error");

afterEach(cleanup);

describe("statistics error", () => {
  it("re-runs the server read on retry, not only a re-render", async () => {
    const reset = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ Error: en.Error }}>
        <StatisticsError reset={reset} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("alert").textContent).toContain(en.Error.title);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: en.Error.retry })));
    expect(refresh).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });
});
