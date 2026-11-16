import { signedUrlResponseSchema } from "@repo/shared";

export type DownloadResult =
  | { ok: true; url: string }
  /** `message` is the server's text in the visitor's language, when it sent one. */
  | { ok: false; code: string | null; message: string | null };

/**
 * `POST /api/resources/:id/download`. A direct resource needs no email; an
 * email-gated one is refused with `validation_failed` without it. The answer is a
 * signed URL that lasts 60 seconds, so it's followed at once and never kept.
 */
export async function requestDownload(
  id: string,
  email?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DownloadResult> {
  let response: Response;
  try {
    response = await fetchImpl(`/api/resources/${encodeURIComponent(id)}/download`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(email === undefined ? {} : { email }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: null, message: null };
  }
  const reply = (await response.json().catch(() => null)) as unknown;
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
