import {
  resourceDownloadRequestSchema,
  uuidSchema,
  type Locale,
  type ResourceAccess,
  type SignedUrlResponse,
} from "@repo/shared";
import { fail, type Result } from "./errors";

/** A published resource, as the download needs it. The key never leaves the server. */
export type DownloadableResource = { storageKey: string; access: ResourceAccess };

export type ResourceStore = {
  /** The published resource, or null: a draft is as absent as a missing row. */
  findPublished: (id: string) => Promise<DownloadableResource | null>;
  /** A signed URL for the file in the private `resources` bucket, 60 seconds. */
  signDownload: (storageKey: string) => Promise<string>;
};

export type ResourceDownloadDeps = {
  locale: Locale;
  store: ResourceStore;
  /** False when the address is disposable, invalid or has no mail server. */
  isAcceptableEmail: (email: string) => Promise<boolean>;
  /**
   * Schedules the newsletter's double opt-in for this address (§6.15): a
   * `pending` row and the confirm email, nothing else. Called only with
   * explicit consent. It returns at once: the signup runs after the response,
   * so a slow or failing one never holds up the file.
   */
  subscribe: (email: string, locale: Locale) => void;
};

/**
 * `POST /api/resources/:id/download` (§6.9). A `direct` resource answers with
 * the signed URL. An `email` resource needs an acceptable email first.
 */
export async function downloadResource(
  id: string,
  body: unknown,
  deps: ResourceDownloadDeps,
): Promise<Result<SignedUrlResponse>> {
  const { locale, store } = deps;
  if (!uuidSchema.safeParse(id).success) return fail("notFound", locale);
  const parsed = resourceDownloadRequestSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", locale);
  const { email, consent } = parsed.data;

  const resource = await store.findPublished(id);
  if (!resource) return fail("notFound", locale);

  if (resource.access === "email" && email === undefined) return fail("emailRequired", locale);
  if (email !== undefined && !(await deps.isAcceptableEmail(email))) {
    return fail("emailInvalid", locale);
  }

  // The email joins the newsletter only with explicit consent (§6.9). The
  // download never waits on the signup.
  if (consent === true && email !== undefined) deps.subscribe(email, locale);

  return { status: 200, body: { url: await store.signDownload(resource.storageKey) } };
}
