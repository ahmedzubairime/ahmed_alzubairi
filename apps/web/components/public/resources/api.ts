import { signedUrlResponseSchema } from "@repo/shared";

export type DownloadResult =
  | { ok: true; url: string }
  /** `message` is the server's text in the visitor's language, when it sent one. */
  | { ok: false; code: string | null; message: string | null };

/** How long a download request may take before the visitor gets the form back. */
export const DOWNLOAD_TIMEOUT_MS = 15_000;

/**
 * `POST /api/resources/:id/download`. A direct resource needs no email; an
 * email-gated one is refused with `validation_failed` without it. The answer is a
 * signed URL that lasts 60 seconds, so it's followed at once and never kept.
 * A request that takes longer than `timeoutMs` is aborted and reported as a
 * failure, so no late answer can start a download.
 */
export async function requestDownload(
  id: string,
  email?: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
): Promise<DownloadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let reply: unknown;
  try {
    response = await fetchImpl(`/api/resources/${encodeURIComponent(id)}/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(email === undefined ? {} : { email }),
      cache: "no-store",
      signal: controller.signal,
    });
    reply = (await response.json().catch(() => null)) as unknown;
  } catch {
    return { ok: false, code: null, message: null };
  } finally {
    clearTimeout(timer);
  }
  if (controller.signal.aborted) return { ok: false, code: null, message: null };
  if (response.ok) {
    const body = signedUrlResponseSchema.safeParse(reply);
    return body.success ? { ok: true, url: body.data.url } : { ok: false, code: null, message: null };
  }
  const error = (reply as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return {
    ok: false,
    code: typeof error?.code === "string" ? error.code : null,
    message: typeof error?.message === "string" ? error.message : null,
  };
}

/** Follows the signed URL. The file is sent as an attachment, so the page stays. */
export function startDownload(url: string) {
  window.location.assign(url);
}
