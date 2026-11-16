import {
  NEWSLETTER_EXPORT_COLUMNS,
  PERMISSIONS,
  type NewsletterSubscriber,
  type Permission,
} from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry } from "../audit";
import type { PermissionDeps } from "../permissions";
import { CSV_BOM, csvCell, toCsv } from "./csv";
import { handleNewsletterExport, type NewsletterExportDeps } from "./route";
import {
  countSignupsSince,
  exportSubscribers,
  listSubscribers,
  literalPattern,
} from "./store";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const EDITOR = "user_editor";
const NOW = "2026-11-15T10:00:00.000Z";

const subscriber = (rest: Partial<NewsletterSubscriber> = {}): NewsletterSubscriber => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  email: "reader@example.com",
  locale: "ar",
  status: "confirmed",
  source: "footer",
  consentedAt: "2026-11-01T08:00:00.000Z",
  createdAt: "2026-11-01T07:59:00.000Z",
  ...rest,
});

describe("csvCell", () => {
  it.each([
    ["=1+1", `"'=1+1"`],
    ["+966500000000", `"'+966500000000"`],
    ["-2+3", `"'-2+3"`],
    ["@SUM(A1)", `"'@SUM(A1)"`],
    ["\t=1+1", `"'\t=1+1"`],
    ["\r=1+1", `"'\r=1+1"`],
    ['=HYPERLINK("http://evil.example","x")', `"'=HYPERLINK(""http://evil.example"",""x"")"`],
  ])("makes %j text, not a formula", (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });

  it.each([
    ["reader@example.com", `"reader@example.com"`],
    ["a=b", `"a=b"`],
    ["2026-11-01T08:00:00.000Z", `"2026-11-01T08:00:00.000Z"`],
    ["قارئ", `"قارئ"`],
    ["", `""`],
    [null, `""`],
  ])("leaves %j as it is", (value, cell) => {
    expect(csvCell(value)).toBe(cell);
  });

  it("keeps a comma, a quote and a line break inside one cell", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});

describe("toCsv", () => {
  it("starts with the byte order mark, then the header, CRLF line ends", () => {
    const csv = toCsv(["email", "locale"], [["a@example.com", "ar"], ["=1+1", null]]);
    expect(csv).toBe(`${CSV_BOM}"email","locale"\r\n"a@example.com","ar"\r\n"'=1+1",""\r\n`);
    // The mark is the three bytes Excel looks for.
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});

describe("GET /api/admin/newsletter/export", () => {
  function routeDeps(userId: string | null, held: Permission[], rows: NewsletterSubscriber[] = []) {
    const permission: PermissionDeps = {
      getUserId: async () => userId,
      hasPermission: vi.fn(async (key: Permission) => held.includes(key)),
    };
    const deps = {
      permission,
      load: vi.fn<NewsletterExportDeps["load"]>(async () => rows),
      audit: vi.fn<(entry: AuditEntry) => Promise<void>>(async () => {}),
      now: () => new Date(NOW),
    } satisfies NewsletterExportDeps;
    return { deps, permission };
  }

  const get = (query = "") =>
    new Request(`https://site.example/api/admin/newsletter/export${query}`, {
      headers: { referer: "https://site.example/en/dashboard/newsletter" },
    });

  it("answers 401 when signed out", async () => {
    const { deps } = routeDeps(null, []);
    const response = await handleNewsletterExport(get(), deps);
    expect(response.status).toBe(401);
    expect(deps.load).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("answers 403 without content.manage, whatever else the member holds", async () => {
    const others = Object.values(PERMISSIONS).filter((key) => key !== PERMISSIONS.CONTENT_MANAGE);
    const { deps, permission } = routeDeps("user_coordinator", others, [subscriber()]);
    const response = await handleNewsletterExport(get(), deps);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(permission.hasPermission).toHaveBeenCalledWith(PERMISSIONS.CONTENT_MANAGE);
    // No address is read, and nothing is audited, before the check passes.
    expect(deps.load).not.toHaveBeenCalled();
    expect(deps.audit).not.toHaveBeenCalled();
  });

  it("downloads a CSV of the confirmed subscribers, and audits the count only", async () => {
    const rows = [
      subscriber(),
      subscriber({ email: "second@example.com", locale: "en", source: "blog", consentedAt: null }),
    ];
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE], rows);
    const response = await handleNewsletterExport(get(), deps);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="newsletter-subscribers-2026-11-15.csv"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes)).toBe(
      [
        `${CSV_BOM}"email","locale","source","consented_at"`,
        `"reader@example.com","ar","footer","2026-11-01T08:00:00.000Z"`,
        `"second@example.com","en","blog",""`,
        "",
      ].join("\r\n"),
    );
    expect(NEWSLETTER_EXPORT_COLUMNS).toEqual(["email", "locale", "source", "consented_at"]);

    expect(deps.audit).toHaveBeenCalledWith({
      actorId: EDITOR,
      action: "newsletter.export",
      entity: "newsletter_subscribers",
      entityId: null,
      metadata: { count: 2, searched: false },
    });
    expect(JSON.stringify(deps.audit.mock.calls)).not.toContain("example.com");
  });

  it("a pending and an unsubscribed row never appear in the file", async () => {
    // Even if the loader handed them over.
    const rows = [
      subscriber({ email: "pending@example.com", status: "pending" }),
      subscriber({ email: "confirmed@example.com" }),
      subscriber({ email: "gone@example.com", status: "unsubscribed" }),
    ];
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE], rows);
    const csv = await (await handleNewsletterExport(get(), deps)).text();
    expect(csv).toContain("confirmed@example.com");
    expect(csv).not.toContain("pending@example.com");
    expect(csv).not.toContain("gone@example.com");
    expect(deps.audit.mock.calls[0]?.[0].metadata).toEqual({ count: 1, searched: false });
  });

  it.each(["?status=pending", "?status=unsubscribed", "?status=all", "?status=confirmed&page=3"])(
    "always asks for confirmed rows, whatever %s says",
    async (query) => {
      const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE]);
      expect((await handleNewsletterExport(get(query), deps)).status).toBe(200);
      expect(deps.load).toHaveBeenCalledWith({ status: "confirmed", search: undefined });
    },
  );

  it("applies the page's email search", async () => {
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE], [subscriber()]);
    await handleNewsletterExport(get("?search=%20example.com%20&status=pending"), deps);
    expect(deps.load).toHaveBeenCalledWith({ status: "confirmed", search: "example.com" });
    expect(deps.audit.mock.calls[0]?.[0].metadata).toEqual({ count: 1, searched: true });
    // An empty search is no search.
    await handleNewsletterExport(get("?search="), deps);
    expect(deps.load).toHaveBeenLastCalledWith({ status: "confirmed", search: undefined });
  });

  it("refuses a search that is too long", async () => {
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE]);
    const response = await handleNewsletterExport(get(`?search=${"a".repeat(201)}`), deps);
    expect(response.status).toBe(400);
    expect(deps.load).not.toHaveBeenCalled();
  });

  it("escapes an address that would run as a formula", async () => {
    const rows = [subscriber({ email: "=1+1@example.com" }), subscriber({ email: "+cmd@example.com" })];
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE], rows);
    const csv = await (await handleNewsletterExport(get(), deps)).text();
    expect(csv).toContain(`"'=1+1@example.com"`);
    expect(csv).toContain(`"'+cmd@example.com"`);
  });

  it("an empty list is a file with only the header", async () => {
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE]);
    const csv = await (await handleNewsletterExport(get(), deps)).text();
    expect(csv.replace(CSV_BOM, "")).toBe(`"email","locale","source","consented_at"\r\n`);
  });

  it("answers 500 with no file and no address when the read or the audit fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps } = routeDeps(EDITOR, [PERMISSIONS.CONTENT_MANAGE], [subscriber()]);
    deps.load.mockRejectedValueOnce(new Error("newsletter export failed: 57014"));
    const failed = await handleNewsletterExport(get(), deps);
    expect(failed.status).toBe(500);
    // The audit row is part of the export: without it, no file.
    deps.audit.mockRejectedValueOnce(new Error("audit_log insert failed: 57014"));
    const unaudited = await handleNewsletterExport(get(), deps);
    expect(unaudited.status).toBe(500);
    expect(await unaudited.text()).not.toContain("example.com");
    expect(errors.mock.calls.flat().join(" ")).not.toContain("example.com");
    errors.mockRestore();
  });
});

/** A stand-in for the supabase-js query builder that records what was asked. */
function fakeClient(pages: Record<string, unknown>[][], count: number | null = null) {
  const calls: { table: string; columns: string; options?: unknown; steps: unknown[][] }[] = [];
  let next = 0;
  const client = {
    from(table: string) {
      const call = { table, columns: "", options: undefined as unknown, steps: [] as unknown[][] };
      calls.push(call);
      const builder: Record<string, unknown> = {};
      for (const name of ["eq", "filter", "or", "order", "range", "limit", "gte"]) {
        builder[name] = (...args: unknown[]) => (call.steps.push([name, ...args]), builder);
      }
      builder.select = (columns: string, options?: unknown) => {
        call.columns = columns;
        call.options = options;
        return builder;
      };
      builder.then = (resolve: (value: unknown) => unknown) =>
        resolve({ data: pages[next++] ?? [], error: null, count });
      return builder;
    },
  };
  return { client: client as never, calls };
}

const dbRow = (rest: Record<string, unknown> = {}) => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  email: "reader@example.com",
  locale: "ar",
  status: "confirmed",
  source: "footer",
  consented_at: "2026-11-01T08:00:00+00:00",
  created_at: "2026-11-01T07:59:00+00:00",
  ...rest,
});

describe("the subscriber reads", () => {
  it("lists one page with explicit columns, the status filter and the email search", async () => {
    const { client, calls } = fakeClient([[dbRow()]], 41);
    const result = await listSubscribers(client, {
      page: 2,
      pageSize: 20,
      status: "pending",
      search: "50%_off*",
    });
    expect(result.total).toBe(41);
    expect(result.subscribers).toEqual([subscriber()]);
    const [call] = calls;
    expect(call?.table).toBe("newsletter_subscribers");
    // Never `*` and never the token hash: the member has no grant on it.
    expect(call?.columns).toBe("id, email, locale, status, source, consented_at, created_at");
    expect(call?.steps).toContainEqual(["eq", "status", "pending"]);
    // Matched letter for letter: `*` must not become a wildcard.
    expect(call?.steps).toContainEqual(["filter", "email", "imatch", "50%_off\\*"]);
    expect(call?.steps.map((step) => step[0])).not.toContain("ilike");
    expect(call?.steps).toContainEqual(["range", 20, 39]);
  });

  it("adds no filter when none is given, and drops a row it can't read", async () => {
    const { client, calls } = fakeClient([[dbRow(), dbRow({ status: "bounced" })]], 2);
    const result = await listSubscribers(client, { page: 1, pageSize: 20, search: undefined });
    expect(result.subscribers).toHaveLength(1);
    expect(calls[0]?.steps.map((step) => step[0])).toEqual(["order", "order", "range"]);
  });

  it.each([
    ["*", "\\*"],
    ["a.b", "a\\.b"],
    ["1+1", "1\\+1"],
    ["^a|b$", "\\^a\\|b\\$"],
    ["(x)[y]{z}?", "\\(x\\)\\[y\\]\\{z\\}\\?"],
    ["back\\slash", "back\\\\slash"],
    ["plain_text%", "plain_text%"],
  ])("makes the search %j a literal", (term, pattern) => {
    expect(literalPattern(term)).toBe(pattern);
    // And as a regex it matches exactly the term, case-insensitively.
    const regex = new RegExp(pattern, "i");
    expect(regex.test(`x${term.toUpperCase()}x`)).toBe(true);
    expect(regex.test("reader@example.com")).toBe(false);
  });

  it("exports in batches that start after the last row read, with the same filter each time", async () => {
    const first = [
      dbRow({ id: "a1", email: "r1@example.com", created_at: "2026-11-01T07:00:00.123456+00:00" }),
      dbRow({ id: "a2", email: "r2@example.com", created_at: "2026-11-01T08:00:00.654321+00:00" }),
    ];
    const { client, calls } = fakeClient([first, [dbRow({ id: "a3", email: "last@example.com" })]]);
    const rows = await exportSubscribers(client, { status: "confirmed", search: "example" }, 2);
    expect(rows.map((row) => row.email)).toEqual(["r1@example.com", "r2@example.com", "last@example.com"]);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.columns).not.toContain("confirm_token_hash");
      expect(call.steps).toContainEqual(["eq", "status", "confirmed"]);
      expect(call.steps).toContainEqual(["filter", "email", "imatch", "example"]);
      expect(call.steps).toContainEqual(["limit", 2]);
      // Never a row number: an offset shifts when a row leaves the filter.
      expect(call.steps.map((step) => step[0])).not.toContain("range");
    }
    expect(calls[0]?.steps.map((step) => step[0])).not.toContain("or");
    // The cursor is the time exactly as the database wrote it, then the id.
    expect(calls[1]?.steps).toContainEqual([
      "or",
      'created_at.gt."2026-11-01T08:00:00.654321+00:00",and(created_at.eq."2026-11-01T08:00:00.654321+00:00",id.gt.a2)',
    ]);
  });

  it("a subscriber who unsubscribes between batches doesn't make the export skip one", async () => {
    // A table that answers the way Postgres would: filter, cursor, order, limit.
    const table = ["a", "b", "c", "d", "e"].map((id, index) => ({
      ...dbRow({ id, email: `${id}@example.com` }),
      created_at: `2026-11-0${index + 1}T08:00:00+00:00`,
    }));
    let reads = 0;
    const client = {
      from() {
        let status: string | undefined;
        let after: { created_at: string; id: string } | undefined;
        let limit = Infinity;
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: (_column: string, value: string) => ((status = value), builder),
          filter: () => builder,
          order: () => builder,
          or: (filter: string) => {
            const match = /^created_at\.gt\."([^"]+)",and\(created_at\.eq\."\1",id\.gt\.(\w+)\)$/.exec(filter);
            if (!match) throw new Error(`unexpected cursor ${filter}`);
            after = { created_at: match[1] ?? "", id: match[2] ?? "" };
            return builder;
          },
          limit: (count: number) => ((limit = count), builder),
          then: (resolve: (value: unknown) => unknown) => {
            const data = table
              .filter((row) => !status || row.status === status)
              .filter(
                (row) =>
                  !after ||
                  row.created_at > after.created_at ||
                  (row.created_at === after.created_at && row.id > after.id),
              )
              .slice(0, limit);
            reads += 1;
            // After the first batch is read, its first subscriber unsubscribes.
            if (reads === 1) table[0]!.status = "unsubscribed";
            return resolve({ data, error: null });
          },
        };
        return builder;
      },
    };
    const rows = await exportSubscribers(client as never, { status: "confirmed" }, 2);
    // With row numbers, "c" would slide into the first batch's place and be skipped.
    expect(rows.map((row) => row.email)).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
      "d@example.com",
      "e@example.com",
    ]);
  });

  it("counts signups since a date without reading a row", async () => {
    const { client, calls } = fakeClient([[]], 7);
    expect(await countSignupsSince(client, new Date(NOW))).toBe(7);
    expect(calls[0]?.options).toEqual({ count: "exact", head: true });
    expect(calls[0]?.steps).toContainEqual(["gte", "created_at", NOW]);
  });
});
