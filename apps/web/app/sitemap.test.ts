import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connected: false }));
vi.mock("next/server", () => ({
  connection: async () => {
    mocks.connected = true;
  },
}));
vi.mock("@/lib/content/sitemap", () => ({
  getSitemapPages: async () => [{ key: "about", locales: ["ar"], lastModified: null }],
  getSitemapItems: async () => [
    { paths: { ar: "/services/x", en: "/services/x" }, lastModified: "2026-11-01T00:00:00Z" },
  ],
}));

const { default: sitemap } = await import("./sitemap");

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example"));
afterEach(() => vi.unstubAllEnvs());

describe("/sitemap.xml", () => {
  it("renders on request and joins listings, content pages and items", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(mocks.connected).toBe(true);
    expect(urls).toContain("https://site.example/en/services");
    expect(urls).toContain("https://site.example/ar/about");
    expect(urls).not.toContain("https://site.example/en/about");
    expect(urls).toContain("https://site.example/en/services/x");
  });
});
