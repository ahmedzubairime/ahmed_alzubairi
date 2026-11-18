import { describe, expect, it } from "vitest";
import { monthChange, plotted, sharePercent } from "./format";

describe("monthChange", () => {
  it("is the signed change since last month, more is better", () => {
    expect(monthChange([1, 2, 5], "en", "vs last month")).toEqual({ direction: "up", tone: "better", value: "+3", label: "vs last month" });
    expect(monthChange([4, 1], "en", "x")).toMatchObject({ direction: "down", tone: "worse", value: "-3" });
    expect(monthChange([2, 2], "en", "x")).toMatchObject({ direction: "flat", tone: "neutral", value: "0" });
    expect(monthChange([2], "en", "x")).toBeUndefined();
  });
});

describe("sharePercent", () => {
  it("is sign-ups over visitors, to one decimal, 0 with no visitors", () => {
    expect(sharePercent(1, 3)).toBe(33.3);
    expect(sharePercent(0, 0)).toBe(0);
    expect(sharePercent(5, 0)).toBe(0);
  });
});

describe("plotted", () => {
  it("drops a series of zeros so the chart shows its empty state", () => {
    expect(plotted([{ value: 0 }, { value: 0 }])).toEqual([]);
    expect(plotted([{ value: 0 }, { value: 1 }])).toHaveLength(2);
  });
});
