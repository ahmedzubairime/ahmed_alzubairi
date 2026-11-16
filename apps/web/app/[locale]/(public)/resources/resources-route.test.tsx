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
vi.mock("@/components/public/resources", () => ({
  ResourcesList: () => <p>list</p>,
  parseResourcesQuery: () => ({}),
}));
vi.mock("@/lib/content", () => ({ getExpertiseAreas: async () => [] }));
vi.mock("@/lib/content/resources", () => ({ getResources: async () => [], getMediaItems: async () => [] }));

const page = await import("./page");
const props = (locale: string) => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) });

afterEach(cleanup);

describe("/resources", () => {
  it("has a title and description per language", async () => {
    expect(await page.generateMetadata(props("ar"))).toEqual({
      title: "ar:Resources.title",
      description: "ar:Resources.description",
    });
    expect(await page.generateMetadata(props("en"))).toEqual({
      title: "en:Resources.title",
      description: "en:Resources.description",
    });
    expect(await page.generateMetadata(props("fr"))).toEqual({});
  });

  it("shows the page's title in its hero", async () => {
    render(await page.default(props("en")));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("en:Resources.title");
  });

  it("is not found for an unknown locale", async () => {
    await expect(page.default(props("fr"))).rejects.toThrow("NOT_FOUND");
  });
});
