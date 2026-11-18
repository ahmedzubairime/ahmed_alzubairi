import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { OG_SIZE, renderOgImage, wrapLines } from "./og-image";

describe("wrapLines", () => {
  it("breaks text to fit the width", () => {
    const ctx = createCanvas(1, 1).getContext("2d");
    ctx.font = "40px sans-serif";
    const lines = wrapLines(ctx, "one two three four five six seven eight", 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe("one two three four five six seven eight");
  });
});

describe("renderOgImage", () => {
  it("draws a 1200×630 PNG in both directions", () => {
    for (const direction of ["rtl", "ltr"] as const) {
      const png = renderOgImage({ siteName: "Site", tagline: "استشارات في الإدارة", direction });
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(png.readUInt32BE(16)).toBe(OG_SIZE.width);
      expect(png.readUInt32BE(20)).toBe(OG_SIZE.height);
    }
  });
});
