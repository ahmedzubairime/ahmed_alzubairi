import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  release: () => {},
  pages: vi.fn(async () => [{ key: "about", locales: ["ar"], lastModified: null }]),
  items: vi.fn(async () => [
    { paths: { ar: "/services/x", en: "/services/x" }, lastModified: "2026-11-01T00:00:00Z" },
  ]),
}));
vi.mock("next/server", () => ({
  // Pending until the test releases it, so a read before it would show.
  connection: () => new Promise<void>((resolve) => (mocks.release = resolve)),
}));
vi.mock("@/lib/content/sitemap", () => ({
  getSitemapPages: mocks.pages,
  getSitemapItems: mocks.items,
}));

const { default: sitemap } = await import("./sitemap");

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://site.example"));
afterEach(() => vi.unstubAllEnvs());

describe("/sitemap.xml", () => {
  it("reads content only after connection(), then joins listings, content pages and items", async () => {
    const pending = sitemap();
    await Promise.resolve();
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.items).not.toHaveBeenCalled();

    mocks.release();
    const urls = (await pending).map((entry) => entry.url);
    expect(urls).toContain("https://site.example/en/services");
    expect(urls).toContain("https://site.example/ar/about");
    expect(urls).not.toContain("https://site.example/en/about");
    expect(urls).toContain("https://site.example/en/services/x");
  });
});
