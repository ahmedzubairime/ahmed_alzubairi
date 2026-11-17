// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => (key: string) =>
    `${locale}:${namespace}.${key}`,
}));
vi.mock("@/components/public/parts", () => ({ PageHero: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ui", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/public/media", () => ({
  MediaList: () => <p>list</p>,
  parseMediaQuery: () => ({}),
}));
vi.mock("@/lib/content", () => ({ getExpertiseAreas: async () => [] }));
vi.mock("@/lib/content/media", () => ({ getMedia: async () => [], getMediaItems: async () => [] }));

const page = await import("./page");
const props = (locale: string) => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });

afterEach(cleanup);

describe("/media", () => {
  it("has a title and description per language", async () => {
    expect(await page.generateMetadata(props("ar"))).toEqual({
      title: "ar:Media.title",
      description: "ar:Media.description",
    });
    expect(await page.generateMetadata(props("en"))).toEqual({
      title: "en:Media.title",
      description: "en:Media.description",
    });
    expect(await page.generateMetadata(props("fr"))).toEqual({});
  });

  it("shows the page's title in its hero", async () => {
    render(await page.default(props("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("en:Media.title");
  });

  it("is not found for an unknown locale", async () => {
    await expect(page.default(props("fr"))).rejects.toThrow("NOT_FOUND");
  });
});
