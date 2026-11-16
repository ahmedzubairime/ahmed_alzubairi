"use client";

import type { ResourceAccess } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { requestDownload, startDownload } from "./api";

/**
 * A resource card's action (§6.9). A direct resource downloads in one click.
 * An email-gated one opens the dialog first, and downloads only once the
 * server has accepted the email.
 */
export function ResourceDownload({ id, title, access }: { id: string; title: string; access: ResourceAccess }) {
  const t = useTranslations("Resources");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    setStarted(false);
    const result = await requestDownload(id);
    setBusy(false);
    if (result.ok) {
      setStarted(true);
      startDownload(result.url);
      // A request with no body is only ever invalid for want of the email: the
      // resource became email-gated after the page was cached. Ask for it.
    } else if (result.code === "validation_failed") setOpen(true);
    else setError(result.message ?? t("failed"));
  }

  return (
    <div className="grid w-full justify-items-start gap-2">
      <Button
        variant={access === "email" ? "secondary" : "primary"}
        loading={busy}
        loadingLabel={t("preparing")}
        aria-label={t(access === "email" ? "downloadByEmailLabel" : "downloadLabel", { title })}
        onClick={access === "email" ? () => setOpen(true) : download}
      >
        {t(access === "email" ? "downloadByEmail" : "download")}
      </Button>
      <p role="status" className="text-sm text-text-secondary empty:hidden">
        {started ? t("started") : null}
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      {open && <EmailGateDialog id={id} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
}

type GateState = { step: "form"; error: string | null } | { step: "sending" } | { step: "done" };

/**
 * Asks for the email, then downloads. A native modal `<dialog>`, so focus
 * stays inside and Esc closes it. The email goes only to the download route.
 */
export function EmailGateDialog({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const t = useTranslations("Resources");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<GateState>({ step: "form", error: null });
  const busy = state.step === "sending";

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (element && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    }
    return () => {
      if (element?.open && typeof element.close === "function") element.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!address) {
      setMissing(true);
      return;
    }
    setState({ step: "sending" });
    const result = await requestDownload(id, address);
    if (result.ok) {
      setState({ step: "done" });
      startDownload(result.url);
    } else setState({ step: "form", error: result.message ?? t("failed") });
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-lg border border-text/15 bg-surface p-0 text-text shadow-lg backdrop:bg-primary/70 backdrop:backdrop-blur-[2px]"
    >
      {state.step === "done" ? (
        <div className="space-y-4 p-6">
          <h2 id={titleId} role="status" className="text-xl text-balance">
            {t("started")}
          </h2>
          <p className="max-w-prose text-pretty text-text-secondary">{t("startedText")}</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {t("close")}
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="space-y-4 p-6">
          <h2 id={titleId} className="text-xl text-balance">
            {t("gateTitle")}
          </h2>
          {/* The title is text, never HTML (§9). */}
          <p className="font-semibold wrap-anywhere">{title}</p>
          <p className="max-w-prose text-pretty text-text-secondary">{t("gateIntro")}</p>
          <fieldset disabled={busy} className="min-w-0">
            <TextField
              type="email"
              label={t("email")}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setMissing(false);
              }}
              error={missing ? t("emailRequired") : undefined}
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              required
              autoFocus
            />
          </fieldset>
          {state.step === "form" && state.error && (
            <p role="alert" className="text-sm font-semibold text-danger">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap-reverse justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={busy} loadingLabel={t("preparing")}>
              {t("gateSubmit")}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
