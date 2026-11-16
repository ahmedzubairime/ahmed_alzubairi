import "server-only";
import type { Database } from "@repo/db";
import {
  localeSchema,
  newsletterSourceSchema,
  newsletterStatusSchema,
  pageRange,
  type NewsletterStatus,
  type NewsletterSubscriber,
  type NewsletterSubscriberList,
  type NewsletterSubscriberListParams,
} from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;

/**
 * The columns a member may read. Never `confirm_token_hash`: `authenticated`
 * has no grant on it, so naming it (or `*`) would fail the whole read.
 */
const COLUMNS = "id, email, locale, status, source, consented_at, created_at";

type Row = {
  id: string;
  email: string;
  locale: string;
  status: string;
  source: string;
  consented_at: string | null;
  created_at: string;
};

const utc = (value: string) => new Date(value).toISOString();

/** A row in the API shape, or null when a value isn't one the app knows. */
function toSubscriber(row: Row): NewsletterSubscriber | null {
  const locale = localeSchema.safeParse(row.locale);
  const status = newsletterStatusSchema.safeParse(row.status);
  const source = newsletterSourceSchema.safeParse(row.source);
  if (!locale.success || !status.success || !source.success) return null;
  return {
    id: row.id,
    email: row.email,
    locale: locale.data,
    status: status.data,
    source: source.data,
    consentedAt: row.consented_at === null ? null : utc(row.consented_at),
    createdAt: utc(row.created_at),
  };
}

type Filter = { status?: NewsletterStatus; search?: string };

/** The status filter and the email search, on a list or a count query. */
function filtered<Query extends {
  eq: (column: string, value: string) => Query;
  filter: (column: string, operator: string, value: string) => Query;
}>(start: Query, filter: Filter): Query {
  let query = start;
  if (filter.status) query = query.eq("status", filter.status);
  // A case-insensitive regex match on the escaped term, not `ilike`:
  // PostgREST turns every `*` in a like pattern into `%`, and that can't be
  // escaped, so a search for `*` would match every address.
  if (filter.search) query = query.filter("email", "imatch", literalPattern(filter.search));
  return query;
}

/**
 * A search term as a regular expression that matches it letter for letter:
 * every character with a meaning in a regex is escaped.
 */
export function literalPattern(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One page of subscribers, newest first. `user` carries the member's own
 * token, so RLS decides: without `content.manage` it returns nothing (§9).
 */
export async function listSubscribers(
  user: Client,
  params: NewsletterSubscriberListParams,
): Promise<NewsletterSubscriberList> {
  const { from, to } = pageRange(params);
  const { data, error, count } = await filtered(
    user.from("newsletter_subscribers").select(COLUMNS, { count: "exact" }),
    params,
  )
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  // Past the last page PostgREST answers "range not satisfiable", with no
  // count: an empty page, and the total from a count of its own.
  if (error?.code === "PGRST103") {
    return { subscribers: [], total: await countSubscribers(user, params) };
  }
  if (error) throw new Error(`newsletter list failed: ${error.code}`);
  return {
    subscribers: data.flatMap((row) => toSubscriber(row) ?? []),
    total: count ?? data.length,
  };
}

async function countSubscribers(user: Client, filter: Filter): Promise<number> {
  const { count, error } = await filtered(
    user.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
    filter,
  );
  if (error) throw new Error(`newsletter count failed: ${error.code}`);
  return count ?? 0;
}

/** Rows read per request while exporting. */
export const EXPORT_BATCH_SIZE = 1000;

/**
 * Every subscriber the filter matches, oldest first, for the CSV. Read in
 * batches with the member's own client, so RLS applies here too.
 *
 * Each batch starts after the last row of the one before (`created_at`, then
 * `id`), not at a row number. A subscriber who confirms or unsubscribes while
 * the export runs then can't shift the rows and make it skip one.
 */
export async function exportSubscribers(
  user: Client,
  filter: Filter,
  batchSize: number = EXPORT_BATCH_SIZE,
): Promise<NewsletterSubscriber[]> {
  const all: NewsletterSubscriber[] = [];
  let last: { created_at: string; id: string } | undefined;
  for (;;) {
    let query = filtered(user.from("newsletter_subscribers").select(COLUMNS), filter);
    if (last) {
      // The time as the database wrote it, quoted: it holds `:`, `.` and `+`.
      query = query.or(
        `created_at.gt."${last.created_at}",and(created_at.eq."${last.created_at}",id.gt.${last.id})`,
      );
    }
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id")
      .limit(batchSize);
    if (error) throw new Error(`newsletter export failed: ${error.code}`);
    all.push(...data.flatMap((row) => toSubscriber(row) ?? []));
    last = data.at(-1);
    if (data.length < batchSize || !last) break;
  }
  return all;
}

/** How many addresses signed up since `since`, whatever their status now. */
export async function countSignupsSince(user: Client, since: Date): Promise<number> {
  const { count, error } = await user
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  if (error) throw new Error(`newsletter count failed: ${error.code}`);
  return count ?? 0;
}

