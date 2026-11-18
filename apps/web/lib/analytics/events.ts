import { LOCALES, ORG_TYPES, RESOURCE_ACCESS_MODES, type Locale, type OrgType, type ResourceAccess } from "@repo/shared";

/**
 * The product events of §6.23 and the only properties each may carry. Every
 * property is non-personal (§9): never a name, email, phone, message text,
 * subject, file name, organization name, or an id that leads to a person
 * (Clerk user, consultation, request). `locale` is added by `track` itself.
 */
export type AnalyticsEvents = {
  signed_up: Record<string, never>;
  consultation_requested: { service_slug?: string };
  document_requested: { count: number };
  course_registered: { course_slug?: string };
  newsletter_confirmed: Record<string, never>;
  resource_downloaded: { resource_access: ResourceAccess };
  contact_sent: { org_type: OrgType };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

/** A slug, as content slugs are written (Arabic letters too). Never free text. */
const SLUG = /^[\p{L}\p{N}]+(-[\p{L}\p{N}]+)*$/u;

type Check = (value: unknown) => boolean;

/** The slug if it is one, else undefined: an odd value leaves the property out, not the event. */
export function slugOrNothing(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return undefined;
  }
  return isSlug(decoded) ? decoded : undefined;
}

const isSlug: Check = (value) => typeof value === "string" && value.length <= 200 && SLUG.test(value);
const oneOf =
  (values: readonly string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);
const isCount: Check = (value) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100;

/** Each event's properties and the check its value must pass. */
const PROPERTY_CHECKS: { [Name in AnalyticsEventName]: Record<string, Check> } = {
  signed_up: {},
  consultation_requested: { service_slug: isSlug },
  document_requested: { count: isCount },
  course_registered: { course_slug: isSlug },
  newsletter_confirmed: {},
  resource_downloaded: { resource_access: oneOf(RESOURCE_ACCESS_MODES) },
  contact_sent: { org_type: oneOf(ORG_TYPES) },
};

/** Required properties: the ones not marked optional above. */
const REQUIRED: { [Name in AnalyticsEventName]: readonly string[] } = {
  signed_up: [],
  consultation_requested: [],
  document_requested: ["count"],
  course_registered: [],
  newsletter_confirmed: [],
  resource_downloaded: ["resource_access"],
  contact_sent: ["org_type"],
};

/** The allow-list `before_send` reads: each event's properties, `locale` included. */
export const EVENT_PROPERTIES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(PROPERTY_CHECKS).map(([name, checks]) => [name, ["locale", ...Object.keys(checks)]]),
);

export function isAnalyticsEvent(name: unknown): name is AnalyticsEventName {
  return typeof name === "string" && Object.hasOwn(PROPERTY_CHECKS, name);
}

/**
 * The event's properties as sent, with `locale`, or null when the event or a
 * property isn't allowed, or a value fails its check.
 */
export function eventProperties(
  name: unknown,
  properties: unknown,
  locale: unknown,
): (Record<string, unknown> & { locale: Locale }) | null {
  if (!isAnalyticsEvent(name)) return null;
  if (!LOCALES.some((item) => item === locale)) return null;
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) return null;
  const checks = PROPERTY_CHECKS[name];
  const entries = Object.entries(properties).filter(([, value]) => value !== undefined);
  for (const [key, value] of entries) {
    const check = Object.hasOwn(checks, key) ? checks[key] : undefined;
    if (!check || !check(value)) return null;
  }
  if (REQUIRED[name].some((key) => !entries.some(([present]) => present === key))) return null;
  return { ...Object.fromEntries(entries), locale: locale as Locale };
}
