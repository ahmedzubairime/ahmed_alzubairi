import { describe, expect, it } from "vitest";
import { SITE_NAME } from "./index";

describe("SITE_NAME", () => {
  it("is the placeholder site name", () => {
    expect(SITE_NAME).toBe("Ahmed Alzubairi");
  });
});
