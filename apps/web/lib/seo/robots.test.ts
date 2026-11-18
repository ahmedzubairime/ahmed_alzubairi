import { describe, expect, it } from "vitest";
import { robotsFor } from "./robots";

const origin = new URL("https://site.example");

describe("robotsFor", () => {
  it("disallows everything outside production", () => {
    for (const env of [undefined, "preview", "development", ""]) {
      expect(robotsFor(env, origin)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    }
  });

  it("allows the site in production and blocks only the API", () => {
    const robots = robotsFor("production", origin);
    expect(robots.sitemap).toBe("https://site.example/sitemap.xml");
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      // noindex pages stay crawlable so crawlers can read their noindex.
      disallow: ["/api/"],
    });
  });
});
