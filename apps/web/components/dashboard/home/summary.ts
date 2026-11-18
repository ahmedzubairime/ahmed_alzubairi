import "server-only";
import type { Database } from "@repo/db";
import { PERMISSIONS, type Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countSignupsSince } from "@/lib/admin/newsletter/store";
import { createUserClient } from "@/lib/supabase/user";
import { loadNewRegistrationCount, NEW_REGISTRATION_DAYS } from "@/components/dashboard/training/data";
import { NEW_SIGNUP_DAYS } from "@/components/dashboard/newsletter/data";

type Client = SupabaseClient<Database>;

/** The summary's numbers (§6.20 Home), in the order the page shows them. */
export const SUMMARY_KEYS = [
  "newRequests",
  "activeConsultations",
  "documentRequests",
  "unreadMessages",
  "registrations",
  "newSubscribers",
] as const;

export type SummaryKey = (typeof SUMMARY_KEYS)[number];

export type SummaryItem = {
  key: SummaryKey;
  count: number;
  /** Its section, pre-filtered where the list supports it. */
  href: string;
  /**
   * `assigned` when RLS returns only the member's assigned rows (they hold
   * `consultations.reply` without `consultations.view_all`).
   */
  scope?: "assigned";
  /** The look-back window, for the counts that have one. */
  days?: number;
};

/** Consultation statuses still being worked on: every one but `closed`. */
export const OPEN_CONSULTATION_STATUSES = ["new", "in_review", "in_progress", "scheduled"] as const;

/** Document requests awaiting the admin's decision (§6.18). */
export const OPEN_DOCUMENT_REQUEST_STATUSES = ["pending_review", "in_contact"] as const;

const DAY = 24 * 60 * 60 * 1000;

async function exact(
  label: string,
  query: PromiseLike<{ count: number | null; error: { code: string } | null }>,
): Promise<number> {
  const { count, error } = await query;
  if (error) throw new Error(`${label} count failed: ${error.code}`);
  return count ?? 0;
}

type Definition = {
  key: SummaryKey;
  /** Any one of these lets RLS return the rows. Never a role name. */
  permissions: readonly Permission[];
  href: string;
  days?: number;
  /** RLS shows a `consultations.reply` member only their assigned rows. */
  assignable?: true;
  count: (client: Client, now: Date) => Promise<number>;
};

const CONSULTATION_ACCESS = [PERMISSIONS.CONSULTATIONS_VIEW_ALL, PERMISSIONS.CONSULTATIONS_REPLY];

const DEFINITIONS: readonly Definition[] = [
  {
    key: "newRequests",
    permissions: CONSULTATION_ACCESS,
    assignable: true,
    href: "/dashboard/consultations?status=new&kind=consultation",
    count: (client) =>
      exact(
        "new consultations",
        client
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .eq("kind", "consultation")
          .eq("status", "new"),
      ),
  },
  {
    key: "activeConsultations",
    permissions: CONSULTATION_ACCESS,
    assignable: true,
    // The list filters one status at a time, so it opens on every consultation.
    href: "/dashboard/consultations?kind=consultation",
    count: (client) =>
      exact(
        "open consultations",
        client
          .from("consultations")
          .select("id", { count: "exact", head: true })
          .eq("kind", "consultation")
          .in("status", [...OPEN_CONSULTATION_STATUSES]),
      ),
  },
  {
    key: "documentRequests",
    permissions: [PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND],
    href: "/dashboard/document-requests",
    count: (client) =>
      exact(
        "open document requests",
        client
          .from("document_requests")
          .select("id", { count: "exact", head: true })
          .in("status", [...OPEN_DOCUMENT_REQUEST_STATUSES]),
      ),
  },
  {
    key: "unreadMessages",
    permissions: [PERMISSIONS.MESSAGES_VIEW],
    href: "/dashboard/messages?read=unread",
    count: (client) =>
      exact(
        "unread messages",
        client.from("contact_messages").select("id", { count: "exact", head: true }).is("read_at", null),
      ),
  },
  {
    key: "registrations",
    permissions: [PERMISSIONS.TRAINING_MANAGE],
    href: "/dashboard/training/registrations",
    days: NEW_REGISTRATION_DAYS,
    count: (client, now) => loadNewRegistrationCount(now, client),
  },
  {
    key: "newSubscribers",
    permissions: [PERMISSIONS.CONTENT_MANAGE],
    href: "/dashboard/newsletter",
    days: NEW_SIGNUP_DAYS,
    count: (client, now) => countSignupsSince(client, new Date(now.getTime() - NEW_SIGNUP_DAYS * DAY)),
  },
];

/** The permissions the summary needs checked. */
export function summaryPermissions(): Permission[] {
  return [...new Set(DEFINITIONS.flatMap((definition) => definition.permissions))];
}

export type SummaryDeps = {
  /** The member's own client: RLS scopes every count. Never the service client. */
  client?: Client;
  now?: Date;
  log?: (message: string) => void;
};

/**
 * The summary for a member with these permissions. A count runs only when
 * the member holds a permission that lets RLS return its rows, so a member
 * without it gets no query and no line. All counts run in parallel as
 * `head` queries. A failed count is logged and left out: it never takes the
 * page down.
 */
export async function loadSummary(
  granted: ReadonlySet<Permission>,
  { client, now = new Date(), log = console.error }: SummaryDeps = {},
): Promise<SummaryItem[]> {
  const allowed = DEFINITIONS.filter((definition) =>
    definition.permissions.some((permission) => granted.has(permission)),
  );
  if (allowed.length === 0) return [];
  const user = client ?? createUserClient();
  const assigned =
    granted.has(PERMISSIONS.CONSULTATIONS_REPLY) && !granted.has(PERMISSIONS.CONSULTATIONS_VIEW_ALL);
  const counts = await Promise.all(
    allowed.map((definition) =>
      definition.count(user, now).catch(() => {
        log(`dashboard: ${definition.key} count failed`);
        return null;
      }),
    ),
  );
  return allowed.flatMap((definition, index): SummaryItem[] => {
    const count = counts[index];
    if (count === null) return [];
    const item: SummaryItem = { key: definition.key, count, href: definition.href };
    if (assigned && definition.assignable) item.scope = "assigned";
    if (definition.days !== undefined) item.days = definition.days;
    return [item];
  });
}
