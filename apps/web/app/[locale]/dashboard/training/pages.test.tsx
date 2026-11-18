import type { AdminCourse } from "@repo/shared";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTeamMember: vi.fn(),
  trainingAccess: vi.fn(),
  loadCourses: vi.fn(),
  loadCourse: vi.fn(),
  loadRegistrations: vi.fn(),
  loadCustomRequests: vi.fn(),
  loadNewRegistrationCount: vi.fn(),
  loadNewSignupCount: vi.fn(),
  grantedPermissions: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/lib/auth/gates", () => ({ requireTeamMember: mocks.requireTeamMember }));
vi.mock("@/components/dashboard/training/data", () => ({
  trainingAccess: mocks.trainingAccess,
  loadCourses: mocks.loadCourses,
  loadCourse: mocks.loadCourse,
  loadRegistrations: mocks.loadRegistrations,
  loadCustomRequests: mocks.loadCustomRequests,
  loadNewRegistrationCount: mocks.loadNewRegistrationCount,
  NEW_REGISTRATION_DAYS: 7,
  parseRegistrationParams: (raw: Record<string, string>) => ({
    page: Number(raw.page ?? 1),
    pageSize: 20,
    ...(raw.course ? { course: raw.course } : {}),
  }),
  parseRequestParams: (raw: Record<string, string>) => ({ page: Number(raw.page ?? 1), pageSize: 20 }),
}));
vi.mock("@/components/dashboard/newsletter/data", () => ({
  loadNewSignupCount: mocks.loadNewSignupCount,
  NEW_SIGNUP_DAYS: 7,
}));
vi.mock("@/components/dashboard/access", () => ({ grantedPermissions: mocks.grantedPermissions }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
  getMessages: async () => ({ DashboardTraining: {}, Workspace: {} }),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null, useRouter: () => ({}) }));

const { default: TrainingPage } = await import("./page");
const { default: NewCoursePage } = await import("./new/page");
const { default: CoursePage } = await import("./[id]/page");
const { default: RegistrationsPage } = await import("./registrations/page");
const { default: RequestsPage } = await import("./requests/page");
const { Refusal } = await import("@/components/dashboard/refusal");
const { PageHeader } = await import("@/components/ui");
const { CourseList } = await import("@/components/dashboard/training/course-list");
const { CourseForm } = await import("@/components/dashboard/training/course-form");
const { DeleteCourse } = await import("@/components/dashboard/training/delete-course");
const { RegistrationList } = await import("@/components/dashboard/training/registration-list");
const { RequestList } = await import("@/components/dashboard/training/request-list");

const params = Promise.resolve({ locale: "en" });
const ID = "11111111-1111-4111-8111-111111111111";
const idParams = Promise.resolve({ locale: "en", id: ID });
const search = (value: Record<string, string> = {}) => Promise.resolve(value);
const COURSE: AdminCourse = {
  id: ID,
  slug: "a-course",
  type: "in_person",
  titleAr: null,
  titleEn: "A course",
  descriptionAr: null,
  descriptionEn: "Text",
  audienceAr: null,
  audienceEn: null,
  startsAt: null,
  placeAr: null,
  placeEn: null,
  onlineUrl: null,
  seats: 10,
  status: "draft",
  registrationCount: 2,
};
const ALL = { locale: "en", allowed: true, canDelete: true };

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const props = node.props as Record<string, unknown>;
  const nested = [props.children, props.actions].flatMap((child) => elements(child as ReactNode));
  return [node, ...nested];
}
const find = (tree: ReactNode, type: unknown) => elements(tree).find((element) => element.type === type);


beforeEach(() => {
  mocks.requireTeamMember.mockReset().mockResolvedValue({});
  mocks.trainingAccess.mockReset().mockResolvedValue(ALL);
  mocks.loadCourses.mockReset().mockResolvedValue([COURSE]);
  mocks.loadCourse.mockReset().mockResolvedValue(COURSE);
  mocks.loadRegistrations.mockReset().mockResolvedValue({ registrations: [{ id: "r1" }], total: 1 });
  mocks.loadCustomRequests.mockReset().mockResolvedValue({ requests: [{ id: "q1" }], total: 1 });
  mocks.loadNewRegistrationCount.mockReset().mockResolvedValue(5);
  mocks.loadNewSignupCount.mockReset().mockResolvedValue(2);
  mocks.grantedPermissions.mockReset();
  mocks.redirect.mockClear();
});

describe("refused without training.manage", () => {
  beforeEach(() => {
    mocks.trainingAccess.mockResolvedValue({ locale: "en", allowed: false, canDelete: true });
  });

  it.each([
    ["/dashboard/training", () => TrainingPage({ params })],
    ["/dashboard/training/new", () => NewCoursePage({ params })],
    ["/dashboard/training/[id]", () => CoursePage({ params: idParams })],
    ["/dashboard/training/registrations", () => RegistrationsPage({ params, searchParams: search() })],
    ["/dashboard/training/requests", () => RequestsPage({ params, searchParams: search() })],
  ])("%s", async (path, open) => {
    const page = await open();
    expect(isValidElement(page) && page.type).toBe(Refusal);
    expect(mocks.requireTeamMember).toHaveBeenCalledWith(expect.anything(), path);
    expect(mocks.loadCourses).not.toHaveBeenCalled();
    expect(mocks.loadCourse).not.toHaveBeenCalled();
    expect(mocks.loadRegistrations).not.toHaveBeenCalled();
    expect(mocks.loadCustomRequests).not.toHaveBeenCalled();
  });
});

describe("/dashboard/training", () => {
  it("lists the courses", async () => {
    const page = await TrainingPage({ params });
    expect(find(page, CourseList)?.props).toEqual({ courses: [COURSE], locale: "en" });
  });

  it("shows the empty state with no courses", async () => {
    mocks.loadCourses.mockResolvedValue([]);
    expect(find(await TrainingPage({ params }), CourseList)).toBeUndefined();
  });
});

describe("/dashboard/training/new and [id]", () => {
  it("shows the create form", async () => {
    expect(find(await NewCoursePage({ params }), CourseForm)?.props).toEqual({ panelHeadingLevel: 2 });
  });

  it("shows the edit form and delete for a member with data.delete", async () => {
    const page = await CoursePage({ params: idParams });
    expect(find(page, CourseForm)?.props).toEqual({ course: COURSE });
    expect(find(page, DeleteCourse)?.props).toEqual({ id: ID, title: "A course", registrationCount: 2 });
  });

  it("hides delete without data.delete", async () => {
    mocks.trainingAccess.mockResolvedValue({ ...ALL, canDelete: false });
    expect(find(await CoursePage({ params: idParams }), DeleteCourse)).toBeUndefined();
  });

  it("is not found for a bad id or a missing course", async () => {
    await expect(CoursePage({ params: Promise.resolve({ locale: "en", id: "x" }) })).rejects.toThrow("not-found");
    mocks.loadCourse.mockResolvedValue(null);
    await expect(CoursePage({ params: idParams })).rejects.toThrow("not-found");
  });
});

describe("/dashboard/training/registrations", () => {
  it("reads with the list params, and names the course when filtered", async () => {
    const page = await RegistrationsPage({ params, searchParams: search({ course: ID }) });
    expect(mocks.loadRegistrations).toHaveBeenCalledWith({ page: 1, pageSize: 20, course: ID });
    expect(find(page, RegistrationList)?.props).toMatchObject({ locale: "en", showCourse: false });
    expect(find(page, PageHeader)?.props).toMatchObject({ title: 'registrations.courseTitle {"title":"A course"}' });
  });

  it("goes to the last page for a page past the end", async () => {
    await expect(RegistrationsPage({ params, searchParams: search({ page: "4" }) })).rejects.toThrow(
      "redirect:/en/dashboard/training/registrations",
    );
  });
});

describe("/dashboard/training/requests", () => {
  it("lists the requests", async () => {
    const page = await RequestsPage({ params, searchParams: search() });
    expect(find(page, RequestList)?.props).toEqual({ requests: [{ id: "q1" }], locale: "en" });
  });
});
