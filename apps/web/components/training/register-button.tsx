"use client";

import { courseRegisterResponseSchema, errorResponseSchema } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

/**
 * The register button of a course page (§6.7). The server decides the seat
 * (`register_for_course`); this only sends the request and shows the answer.
 * Afterwards the page is refreshed, so the seats left and the registered
 * state come from the server, never from what this button assumed.
 */
export function RegisterButton({ courseId }: { courseId: string }) {
  const t = useTranslations("Training.register");
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/register`, { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && courseRegisterResponseSchema.safeParse(body).success) {
        setDone(true);
      } else {
        const parsed = errorResponseSchema.safeParse(body);
        setError(parsed.success ? parsed.data.error.message : t("failed"));
      }
      // Either way the page's seats and state may have changed.
      router.refresh();
    } catch {
      setError(t("networkError"));
    }
    setSending(false);
  }

  if (done) {
    return (
      <p role="status" className="font-semibold text-text">
        {t("justRegistered")}
      </p>
    );
  }

  return (
    <div>
      <Button onClick={register} loading={sending} loadingLabel={t("registering")} className="w-full">
        {t("button")}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
