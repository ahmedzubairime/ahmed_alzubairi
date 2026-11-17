import { useTranslations } from "next-intl";
import { NewsletterForm } from "@/components/newsletter";
import { HomeSectionShell, type SectionBand } from "./section";

/**
 * §6.2 #11: the newsletter signup, under the heading and intro set in the
 * dashboard. Double opt-in through the shared form, with source `home` (§6.15).
 */
export function NewsletterSection({
  heading,
  intro,
  band,
}: {
  heading: string;
  intro?: string;
  band: SectionBand;
}) {
  const t = useTranslations("Newsletter");

  return (
    <HomeSectionShell sectionKey="newsletter" heading={heading} intro={intro} band={band}>
      <div className="max-w-xl">
        <NewsletterForm
          source="home"
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
      </div>
    </HomeSectionShell>
  );
}
