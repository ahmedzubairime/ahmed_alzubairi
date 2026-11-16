import "server-only";
import {
  NEWSLETTER_EXPORT_COLUMNS,
  newsletterSubscriberListParamsSchema,
  PERMISSIONS,
  type NewsletterSubscriber,
} from "@repo/shared";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createUserClient } from "@/lib/supabase/user";
import { writeAudit, type AuditEntry } from "../audit";
import { baseError, requirePermission, type PermissionDeps } from "../permissions";
import { toCsv } from "./csv";
import { exportSubscribers } from "./store";

/**
 * The export holds confirmed subscribers only (§6.15: nothing goes to an
 * address before it confirms, or after it unsubscribes). The file has no
 * status column, so a pending or unsubscribed address must never be in it.
 */
export const EXPORT_STATUS = "confirmed";

export type NewsletterExportDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. Always asked for confirmed rows. */
  load: (filter: { status: typeof EXPORT_STATUS; search?: string }) => Promise<NewsletterSubscriber[]>;
  audit: (entry: AuditEntry) => Promise<void>;
  now: () => Date;
};

const defaultDeps: NewsletterExportDeps = {
  // The member's own client: RLS allows `content.manage`, as for the list.
  load: (filter) => exportSubscribers(createUserClient(), filter),
  audit: (entry) => writeAudit(entry),
  now: () => new Date(),
};

/** A subscriber as the file's cells, in `NEWSLETTER_EXPORT_COLUMNS` order. */
const CELLS: Record<
  (typeof NEWSLETTER_EXPORT_COLUMNS)[number],
  (row: NewsletterSubscriber) => string | null
> = {
  email: (row) => row.email,
  locale: (row) => row.locale,
  source: (row) => row.source,
  consented_at: (row) => row.consentedAt,
};

/**
 * `GET /api/admin/newsletter/export`, with `content.manage` (§8): a CSV of
 * the confirmed subscribers, narrowed by the list's email search (`search`).
 * A `status` in the query is ignored: the file is confirmed-only whatever the
 * page was showing.
 *
 * Every export writes `newsletter.export` to the audit log with the row count
 * only. No address is logged.
 */
export async function handleNewsletterExport(
  request: Request,
  deps: NewsletterExportDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.CONTENT_MANAGE, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) return NextResponse.json(check.body, { status: check.status });

    const raw = new URL(request.url).searchParams.get("search") ?? undefined;
    const parsed = newsletterSubscriberListParamsSchema.safeParse(
      raw === undefined ? {} : { search: raw },
    );
    if (!parsed.success) {
      const refused = baseError("validation_failed", 400, locale);
      return NextResponse.json(refused.body, { status: refused.status });
    }
    const { search } = parsed.data;

    // Filtered again here: a row that isn't confirmed never reaches the file,
    // whatever the loader returned.
    const rows = (await deps.load({ status: EXPORT_STATUS, search })).filter(
      (row) => row.status === EXPORT_STATUS,
    );
    const csv = toCsv(
      NEWSLETTER_EXPORT_COLUMNS,
      rows.map((row) => NEWSLETTER_EXPORT_COLUMNS.map((column) => CELLS[column](row))),
    );

    await deps.audit({
      actorId: check.userId,
      action: "newsletter.export",
      entity: "newsletter_subscribers",
      entityId: null,
      metadata: { count: rows.length, searched: search !== undefined },
    });

    const day = deps.now().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="newsletter-subscribers-${day}.csv"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    // The error's message only (codes, never an address).
    console.error(
      "GET /api/admin/newsletter/export",
      error instanceof Error ? error.message : "error",
    );
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
