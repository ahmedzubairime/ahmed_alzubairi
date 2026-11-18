import { PERMISSIONS, type Permission } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  grantedPermissions: vi.fn(),
  loadStatistics: vi.fn(),
  auth: vi.fn(),
  timezone: null as string | null,
}));

vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/access", () => ({ grantedPermissions: mocks.grantedPermissions }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/components/dashboard/statistics/data", async () => ({
  ...(await vi.importActual<typeof import("@/components/dashboard/statistics/permissions")>(
    "@/components/dashboard/statistics/permissions",
  )),
  loadStatistics: mocks.loadStatistics,
}));
vi.mock("@/lib/supabase/user", () => ({
  createUserClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { timezone: mocks.timezone }, error: null }) }) }),
    }),
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

const { default: StatisticsPage } = await import("./page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { PageHeader } = await import("@/components/ui");

const params = Promise.resolve({ locale: "en" });

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.loadStatistics.mockReset().mockResolvedValue({ windows: [], kpis: [] });
  mocks.auth.mockReset().mockResolvedValue({ userId: "user_1" });
  mocks.timezone = "Asia/Riyadh";
});

describe("/dashboard/statistics", () => {
  it("refuses a member with none of the KPI permissions, and loads nothing", async () => {
    mocks.grantedPermissions.mockResolvedValue(new Set<Permission>());
    const page = await StatisticsPage({ params });
    expect((page as ReactElement).type).toBe(Refusal);
    expect(mocks.loadStatistics).not.toHaveBeenCalled();
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(params, "/dashboard/statistics");
  });

  it("checks exactly the KPI permissions on the server", async () => {
    mocks.grantedPermissions.mockResolvedValue(new Set([PERMISSIONS.TRAINING_MANAGE]));
    await StatisticsPage({ params });
    const [keys, locale] = mocks.grantedPermissions.mock.calls[0]!;
    expect([...keys].sort()).toEqual(
      [
        PERMISSIONS.CONSULTATIONS_VIEW_ALL,
        PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
        PERMISSIONS.TRAINING_MANAGE,
        PERMISSIONS.CONTENT_MANAGE,
        PERMISSIONS.TEAM_MANAGE,
      ].sort(),
    );
    expect(locale).toBe("en");
  });

  it("opens for one KPI's permission and says which time zone it counts in", async () => {
    const granted = new Set([PERMISSIONS.TRAINING_MANAGE]);
    mocks.grantedPermissions.mockResolvedValue(granted);
    const page = (await StatisticsPage({ params })) as ReactElement;
    const header = elements(page).find((element) => element.type === PageHeader)!;
    expect((header.props as { intro: string }).intro).toBe('intro {"timeZone":"Asia/Riyadh"}');
    const body = elements(page).find((element) => (element.props as { timeZone?: string }).timeZone)!;
    expect(body.props).toMatchObject({ granted, locale: "en", timeZone: "Asia/Riyadh" });
  });

  it("counts in UTC when the profile has no usable time zone", async () => {
    mocks.grantedPermissions.mockResolvedValue(new Set([PERMISSIONS.CONTENT_MANAGE]));
    mocks.timezone = null;
    const page = (await StatisticsPage({ params })) as ReactElement;
    const header = elements(page).find((element) => element.type === PageHeader)!;
    expect((header.props as { intro: string }).intro).toBe('intro {"timeZone":"UTC"}');
  });
});
