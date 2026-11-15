"use client";

import {
  errorResponseSchema,
  newsletterSubscribeRequestSchema,
  type NewsletterSource,
} from "@repo/shared";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { routing } from "@/i18n/routing";

/** The form's words, in the page's language. `NewsletterSignup` fills them in. */
export type NewsletterFormLabels = {
  email: string;
  subscribe: string;
  subscribing: string;
  required: string;
  emailInvalid: string;
  networkError: string;
  internalError: string;
  done: string;
};

/**
 * The newsletter signup form (§6.15): an email and a button. After a send it
 * shows one fixed text, whatever the address's state, so the form never tells
 * who is subscribed (§9). The address is never sent to analytics.
 */
export function NewsletterForm({
  source,
  labels,
}: {
  source: NewsletterSource;
  labels: NewsletterFormLabels;
}) {
  const pageLocale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const doneText = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (done) doneText.current?.focus();
  }, [done]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter in the field submits too, so a second send is blocked here as well.
    if (sending) return;
    const form = event.currentTarget;
    const raw = new FormData(form).get("email");
    const email = typeof raw === "string" ? raw.trim() : "";
    const locale = routing.locales.find((known) => known === pageLocale) ?? routing.defaultLocale;
    const parsed = newsletterSubscribeRequestSchema.safeParse({ email, locale, source });
    if (!parsed.success) {
      setError(email ? labels.emailInvalid : labels.required);
      form.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }

    setError(null);
    setSending(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        setDone(true);
      } else {
        const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
        setError(body.success ? body.data.error.message : labels.internalError);
      }
    } catch {
      setError(labels.networkError);
    }
    setSending(false);
  }

  if (done) {
    return (
      <p
        ref={doneText}
        role="status"
        tabIndex={-1}
        className="mt-3 text-sm text-text focus:outline-none"
      >
        {labels.done}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-3 flex flex-wrap items-start gap-3">
      <TextField
        name="email"
        type="email"
        label={labels.email}
        autoComplete="email"
        dir="ltr"
        required
        error={error ?? undefined}
        className="min-w-0 flex-1 basis-56"
      />
      {/* The label's line and its gap, so the button sits level with the field. */}
      <Button type="submit" loading={sending} loadingLabel={labels.subscribing} className="mt-6">
        {labels.subscribe}
      </Button>
    </form>
  );
}
