import { PERMISSIONS, type Permission } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/user", () => ({
  createUserClient: vi.fn(() => {
    throw new Error("tests pass their own client");
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => {
    throw new Error("the summary never uses the service client");
  }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));

const { loadSummary, summaryPermissions, SUMMARY_KEYS } = await import("./summary");
const { createUserClient } = await import("@/lib/supabase/user");

type Filter = [string, string, unknown];
type Query = { table: string; select: unknown[]; filters: Filter[] };
type Answer = { count: number | null; error: { code: string } | null };

/** A supabase-js stand-in that records each query and answers by table. */
function fakeClient(answer: (query: Query) => Answer = () => ({ count: 3, error: null })) {
  const queries: Query[] = [];
  const client = {
    from(table: string) {
      const query: Query = { table, select: [], filters: [] };
      queries.push(query);
      const builder = {
        select: (...args: unknown[]) => ((query.select = args), builder),
        eq: (column: string, value: unknown) => (query.filters.push(["eq", column, value]), builder),
        in: (column: string, value: unknown) => (query.filters.push(["in", column, value]), builder),
        is: (column: string, value: unknown) => (query.filters.push(["is", column, value]), builder),
        gte: (column: string, value: unknown) => (query.filters.push(["gte", column, value]), builder),
        then: (resolve: (value: Answer) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(answer(query)).then(resolve, reject),
      };
      return builder;
    },
  };
  return { client: client as never, queries };
}

const set = (keys: Permission[]) => new Set<Permission>(keys);
const NOW = new Date("2026-11-18T12:00:00Z");
const ADMIN = set(summaryPermissions());

describe("loadSummary", () => {
  it("gives the admin all six numbers, in order, from head count queries", async () => {
    const { client, queries } = fakeClient();
    const items = await loadSummary(ADMIN, { client, now: NOW });
    expect(items.map((item) => item.key)).toEqual([...SUMMARY_KEYS]);
    expect(items.every((item) => item.count === 3 && item.scope === undefined)).toBe(true);
    expect(queries).toHaveLength(6);
    for (const query of queries) {
      expect(query.select).toEqual(["id", { count: "exact", head: true }]);
    }
  });

  it("counts what each label says, and links to the section", async () => {
    const { client, queries } = fakeClient();
    const items = await loadSummary(ADMIN, { client, now: NOW });
    expect(queries.map((query) => [query.table, query.filters])).toEqual([
      ["consultations", [["eq", "kind", "consultation"], ["eq", "status", "new"]]],
      [
        "consultations",
        [["eq", "kind", "consultation"], ["in", "status", ["new", "in_review", "in_progress", "scheduled"]]],
      ],
      ["document_requests", [["in", "status", ["pending_review", "in_contact"]]]],
      ["contact_messages", [["is", "read_at", null]]],
      ["course_registrations", [["gte", "created_at", "2026-11-11T12:00:00.000Z"]]],
      ["newsletter_subscribers", [["gte", "created_at", "2026-11-11T12:00:00.000Z"]]],
    ]);
    expect(Object.fromEntries(items.map((item) => [item.key, [item.href, item.days]]))).toEqual({
      newRequests: ["/dashboard/consultations?status=new&kind=consultation", undefined],
      activeConsultations: ["/dashboard/consultations?kind=consultation", undefined],
      documentRequests: ["/dashboard/document-requests", undefined],
      unreadMessages: ["/dashboard/messages?read=unread", undefined],
      registrations: ["/dashboard/training/registrations", 7],
      newSubscribers: ["/dashboard/newsletter", 7],
    });
  });

  it("shows an assistant consultant only their lines, marked assigned", async () => {
    const { client, queries } = fakeClient();
    const items = await loadSummary(
      set([
        PERMISSIONS.CONSULTATIONS_REPLY,
        PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
        PERMISSIONS.DOCUMENTS_VIEW,
        PERMISSIONS.MESSAGES_VIEW,
      ]),
      { client, now: NOW },
    );
    expect(items.map((item) => [item.key, item.scope])).toEqual([
      ["newRequests", "assigned"],
      ["activeConsultations", "assigned"],
      ["documentRequests", undefined],
      ["unreadMessages", undefined],
    ]);
    expect(queries.map((query) => query.table)).not.toContain("course_registrations");
    expect(queries.map((query) => query.table)).not.toContain("newsletter_subscribers");
  });

  it("drops the assigned label with consultations.view_all", async () => {
    const { client } = fakeClient();
    const items = await loadSummary(
      set([PERMISSIONS.CONSULTATIONS_VIEW_ALL, PERMISSIONS.CONSULTATIONS_REPLY]),
      { client, now: NOW },
    );
    expect(items.map((item) => [item.key, item.scope])).toEqual([
      ["newRequests", undefined],
      ["activeConsultations", undefined],
    ]);
  });

  // Refused cases: without the permission, no query and no line.
  it.each([
    ["consultations", ["newRequests", "activeConsultations"], [PERMISSIONS.CONSULTATIONS_VIEW_ALL, PERMISSIONS.CONSULTATIONS_REPLY]],
    ["document_requests", ["documentRequests"], [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND]],
    ["contact_messages", ["unreadMessages"], [PERMISSIONS.MESSAGES_VIEW]],
    ["course_registrations", ["registrations"], [PERMISSIONS.TRAINING_MANAGE]],
    ["newsletter_subscribers", ["newSubscribers"], [PERMISSIONS.CONTENT_MANAGE]],
  ] as const)("reads no %s without its permission", async (table, keys, missing) => {
    const granted = set(summaryPermissions().filter((key) => !(missing as readonly Permission[]).includes(key)));
    const { client, queries } = fakeClient();
    const items = await loadSummary(granted, { client, now: NOW });
    expect(queries.map((query) => query.table)).not.toContain(table);
    for (const key of keys) expect(items.map((item) => item.key)).not.toContain(key);
    expect(items).toHaveLength(6 - keys.length);
  });

  it("queries nothing, not even a client, for a member with no summary permission", async () => {
    vi.mocked(createUserClient).mockClear();
    expect(await loadSummary(set([PERMISSIONS.DOCUMENTS_VIEW]))).toEqual([]);
    expect(createUserClient).not.toHaveBeenCalled();
  });

  it("leaves a failed count out and logs it without the error text", async () => {
    const log = vi.fn();
    const { client } = fakeClient((query) =>
      query.table === "contact_messages"
        ? { count: null, error: { code: "42501" } }
        : { count: 1, error: null },
    );
    const items = await loadSummary(ADMIN, { client, now: NOW, log });
    expect(items.map((item) => item.key)).not.toContain("unreadMessages");
    expect(items).toHaveLength(5);
    expect(log).toHaveBeenCalledExactlyOnceWith("dashboard: unreadMessages count failed");
  });

  it("survives a count that throws, and every count failing", async () => {
    const log = vi.fn();
    const { client } = fakeClient(() => {
      throw new Error("network down");
    });
    expect(await loadSummary(ADMIN, { client, now: NOW, log })).toEqual([]);
    expect(log).toHaveBeenCalledTimes(6);
  });

  it("reads a null count as zero", async () => {
    const { client } = fakeClient(() => ({ count: null, error: null }));
    const items = await loadSummary(set([PERMISSIONS.MESSAGES_VIEW]), { client, now: NOW });
    expect(items).toEqual([{ key: "unreadMessages", count: 0, href: "/dashboard/messages?read=unread" }]);
  });
});
