"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmTwice } from "@/components/workspace";
import { useRouter } from "@/i18n/navigation";
import { TRAINING_BASE } from "./format";
import { deleteCourse } from "./send";

/**
 * Deletes a course after the double confirmation (§8): its registrations go
 * with it. Shown only with `data.delete`; `DELETE /api/admin/courses/:id`
 * checks it again.
 */
export function DeleteCourse({
  id,
  title,
  registrationCount,
}: {
  id: string;
  title: string;
  registrationCount: number;
}) {
  const t = useTranslations("DashboardTraining.delete");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirm() {
    setBusy(true);
    setError(undefined);
    const result = await deleteCourse(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("failed"));
      return;
    }
    setOpen(false);
    router.push(TRAINING_BASE);
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("button")}
      </Button>
      <ConfirmTwice
        open={open}
        onCancel={() => {
          setOpen(false);
          setError(undefined);
        }}
        onConfirm={() => void confirm()}
        title={t("title")}
        question={t("question", { title, count: registrationCount })}
        word={t("word")}
        confirmLabel={busy ? t("busy") : t("confirm")}
        busy={busy}
        error={error}
      />
    </>
  );
}
