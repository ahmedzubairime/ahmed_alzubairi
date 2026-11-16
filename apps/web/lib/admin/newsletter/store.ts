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
  ilike: (column: string, pattern: string) => Query;
}>(start: Query, filter: Filter): Query {
  let query = start;
  if (filter.status) query = query.eq("status", filter.status);
  // `ilike` takes the pattern as a value, so only the wildcards need escaping.
  if (filter.search) query = query.ilike("email", likePattern(filter.search));
  return query;
}

/** A search term as an `ilike` pattern: `%`, `_` and `\` match themselves. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
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
 */
export async function exportSubscribers(
  user: Client,
  filter: Filter,
): Promise<NewsletterSubscriber[]> {
  const all: NewsletterSubscriber[] = [];
  for (let from = 0; ; from += EXPORT_BATCH_SIZE) {
    const { data, error } = await filtered(
      user.from("newsletter_subscribers").select(COLUMNS),
      filter,
    )
      .order("created_at", { ascending: true })
      .order("id")
      .range(from, from + EXPORT_BATCH_SIZE - 1);
    if (error?.code === "PGRST103") break;
    if (error) throw new Error(`newsletter export failed: ${error.code}`);
    all.push(...data.flatMap((row) => toSubscriber(row) ?? []));
    if (data.length < EXPORT_BATCH_SIZE) break;
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

