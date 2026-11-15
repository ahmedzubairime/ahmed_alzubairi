import type { NewsletterSource } from "@repo/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { NewsletterForm } from "./newsletter-form";

/**
 * The newsletter signup block (§6.15): a title, one line and the form. Use it
 * wherever a signup belongs, with that place as `source`. It reads no session
 * and no data, so it stays inside a static shell, and it brings its own words:
 * the page needs no message provider for it.
 */
export function NewsletterSignup({
  source,
  className,
}: {
  source: NewsletterSource;
  className?: string;
}) {
  const t = useTranslations("Newsletter");
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={className}>
      <h2 id={titleId} className="text-base font-semibold text-text">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-text-secondary">{t("intro")}</p>
      <NewsletterForm
        source={source}
        labels={{
          email: t("email"),
          subscribe: t("subscribe"),
          subscribing: t("subscribing"),
          required: t("required"),
          emailInvalid: t("emailInvalid"),
          networkError: t("networkError"),
          internalError: t("errors.internal_error"),
          done: t("done"),
        }}
      />
    </section>
  );
}
