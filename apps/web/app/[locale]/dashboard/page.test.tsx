import { PERMISSIONS, type Permission } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  grantedPermissions: vi.fn(),
  loadNewRegistrationCount: vi.fn(),
  countSignupsSince: vi.fn(),
  count: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/access", () => ({ grantedPermissions: mocks.grantedPermissions }));
vi.mock("@/components/dashboard/training/data", () => ({
  loadNewRegistrationCount: mocks.loadNewRegistrationCount,
  NEW_REGISTRATION_DAYS: 7,
}));
vi.mock("@/components/dashboard/newsletter/data", () => ({ NEW_SIGNUP_DAYS: 7 }));
vi.mock("@/lib/admin/newsletter/store", () => ({ countSignupsSince: mocks.countSignupsSince }));
// The other counts' queries: every chain resolves to `mocks.count(table)`.
vi.mock("@/lib/supabase/user", () => ({
  createUserClient: () => ({
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        is: () => builder,
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve()
            .then(() => mocks.count(table))
            .then(resolve, reject),
      };
      return builder;
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key} ${JSON.stringify(values)}` : `${namespace}.${key}`,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

const { default: DashboardPage } = await import("./page");
const { SummaryList } = await import("@/components/dashboard/home/summary-list");

const params = Promise.resolve({ locale: "en" });

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  return [node, ...elements(props.children as ReactNode)];
}
const text = (tree: ReactNode): string =>
  elements(tree)
    .flatMap((element) => {
      const { children, label, value } = element.props as { children?: unknown; label?: unknown; value?: unknown };
      // A StatTile carries its text in props.
      return [...(Array.isArray(children) ? children : [children]), label, value].filter((child) => typeof child === "string");
    })
    .join("|");

/** The page, with its summary rendered (an async server component). */
async function render(): Promise<{ page: ReactElement; summary: string; keys: string[] }> {
  const page = (await DashboardPage({ params })) as ReactElement;
  const list = elements(page).find((element) => element.type === SummaryList);
  const items = (list?.props as { items: { key: string }[] } | undefined)?.items ?? [];
  const rendered = list ? await SummaryList(list.props as Parameters<typeof SummaryList>[0]) : null;
  return { page, summary: text(rendered), keys: items.map((item) => item.key) };
}

const grant = (keys: Permission[]) =>
  mocks.grantedPermissions.mockResolvedValue(new Set<Permission>(keys));

beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.grantedPermissions.mockReset();
  mocks.loadNewRegistrationCount.mockReset().mockResolvedValue(5);
  mocks.countSignupsSince.mockReset().mockResolvedValue(2);
  mocks.count.mockReset().mockReturnValue({ count: 4, error: null });
});

describe("dashboard home summary", () => {
  it("checks the summary's permissions with the sections'", async () => {
    grant([]);
    await render();
    const [keys] = mocks.grantedPermissions.mock.calls[0] as [Permission[]];
    expect(keys).toEqual(
      expect.arrayContaining([
        PERMISSIONS.CONSULTATIONS_VIEW_ALL,
        PERMISSIONS.CONSULTATIONS_REPLY,
        PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
        PERMISSIONS.MESSAGES_VIEW,
        PERMISSIONS.TRAINING_MANAGE,
        PERMISSIONS.CONTENT_MANAGE,
      ]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("shows the admin six numbers", async () => {
    grant(Object.values(PERMISSIONS));
    const { keys, summary } = await render();
    expect(keys).toEqual([
      "newRequests",
      "activeConsultations",
      "documentRequests",
      "unreadMessages",
      "registrations",
      "newSubscribers",
    ]);
    expect(summary).toContain("DashboardSummary.heading");
    expect(summary).toContain('DashboardSummary.number {"count":4}');
    expect(summary).toContain('DashboardSummary.items.registrations {"days":7}');
    expect(summary).toContain('DashboardSummary.items.newSubscribers {"days":7}');
    expect(summary).not.toContain("DashboardSummary.assigned");
  });

  it("shows an assistant consultant only assigned consultations, document requests and messages", async () => {
    grant([
      PERMISSIONS.CONSULTATIONS_REPLY,
      PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.MESSAGES_VIEW,
    ]);
    const { keys, summary } = await render();
    expect(keys).toEqual(["newRequests", "activeConsultations", "documentRequests", "unreadMessages"]);
    expect(summary).toContain("DashboardSummary.assigned.newRequests");
    expect(summary).toContain("DashboardSummary.assigned.activeConsultations");
    expect(mocks.loadNewRegistrationCount).not.toHaveBeenCalled();
    expect(mocks.countSignupsSince).not.toHaveBeenCalled();
  });

  it("shows no summary to a member without any of its permissions", async () => {
    grant([PERMISSIONS.DOCUMENTS_MANAGE]);
    const { keys, summary } = await render();
    expect(keys).toEqual([]);
    expect(summary).toBe("");
    expect(mocks.count).not.toHaveBeenCalled();
  });

  // Moved from training/pages.test.tsx: the registrations line.
  it("shows the week's registrations with training.manage", async () => {
    grant([PERMISSIONS.TRAINING_MANAGE]);
    const { keys, summary } = await render();
    expect(mocks.loadNewRegistrationCount).toHaveBeenCalled();
    expect(mocks.countSignupsSince).not.toHaveBeenCalled();
    expect(keys).toEqual(["registrations"]);
    expect(summary).toContain('DashboardSummary.number {"count":5}');
  });

  it("reads no registrations without training.manage", async () => {
    grant([PERMISSIONS.CONTENT_MANAGE]);
    const { keys, summary } = await render();
    expect(mocks.loadNewRegistrationCount).not.toHaveBeenCalled();
    expect(keys).toEqual(["newSubscribers"]);
    expect(summary).toContain('DashboardSummary.number {"count":2}');
    expect(summary).not.toContain("items.registrations");
  });

  it("leaves the line out when the count fails, and keeps the page", async () => {
    grant([PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.MESSAGES_VIEW]);
    mocks.loadNewRegistrationCount.mockRejectedValue(new Error("down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { page, keys, summary } = await render();
    expect(keys).toEqual(["unreadMessages"]);
    expect(summary).not.toContain("items.registrations");
    expect(text(page)).toContain("DashboardContent.nav.training");
    expect(spy).toHaveBeenCalledWith("dashboard: registrations count failed");
    spy.mockRestore();
  });

  it("keeps the section cards when every count fails", async () => {
    grant([PERMISSIONS.MESSAGES_VIEW]);
    mocks.count.mockReturnValue({ count: null, error: { code: "PGRST301" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { page, keys } = await render();
    expect(keys).toEqual([]);
    expect(text(page)).toContain("DashboardContent.nav.messages");
    spy.mockRestore();
  });
});
