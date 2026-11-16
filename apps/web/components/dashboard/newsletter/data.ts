import "server-only";
import {
  DEFAULT_PAGE_SIZE,
  newsletterSubscriberListParamsSchema,
  type NewsletterSubscriberList,
  type NewsletterSubscriberListParams,
} from "@repo/shared";
import { countSignupsSince, listSubscribers } from "@/lib/admin/newsletter/store";
import { createUserClient } from "@/lib/supabase/user";

type RawParams = Record<string, string | string[] | undefined>;

/**
 * The list's params from the page's query string. Only the known keys are
 * read, and a value the schema refuses falls back to its default, so a bad
 * link still opens the list.
 */
export function parseNewsletterParams(raw: RawParams): NewsletterSubscriberListParams {
  const first = (key: string) => {
    const value = raw[key];
    const one = Array.isArray(value) ? value[0] : value;
    return one === undefined || one.trim() === "" ? undefined : one;
  };
  const keys = ["page", "pageSize", "search", "status"] as const;
  const kept = Object.fromEntries(
    keys.flatMap((key) => {
      const value = first(key);
      if (value === undefined) return [];
      const alone = newsletterSubscriberListParamsSchema.safeParse({ [key]: value });
      return alone.success ? [[key, value]] : [];
    }),
  );
  return newsletterSubscriberListParamsSchema.parse(kept);
}

/**
 * One page of subscribers, read with the member's own client: RLS allows
 * `content.manage`. Call it only after the page checked that permission.
 */
export function loadSubscribers(
  params: NewsletterSubscriberListParams,
): Promise<NewsletterSubscriberList> {
  return listSubscribers(createUserClient(), params);
}

/** The days the dashboard's "new signups" count looks back. */
export const NEW_SIGNUP_DAYS = 7;

/**
 * Addresses that signed up in the last `NEW_SIGNUP_DAYS` days, read with the
 * member's own client. Call it only for a member with `content.manage`.
 */
export function loadNewSignupCount(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - NEW_SIGNUP_DAYS * 24 * 60 * 60 * 1000);
  return countSignupsSince(createUserClient(), since);
}

/** The list's address with these params; defaults are left out. */
export function newsletterPath(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: NewsletterSubscriberListParams["status"];
}): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE) {
    query.set("pageSize", String(params.pageSize));
  }
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/dashboard/newsletter?${text}` : "/dashboard/newsletter";
}

/** The export's address: the email search only. The file is always confirmed-only. */
export function exportPath(search?: string): string {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  const text = query.toString();
  return text ? `/api/admin/newsletter/export?${text}` : "/api/admin/newsletter/export";
}
