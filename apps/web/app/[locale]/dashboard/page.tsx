import { PERMISSIONS } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { grantedPermissions } from "@/components/dashboard/access";
import { loadNewSignupCount, NEW_SIGNUP_DAYS } from "@/components/dashboard/newsletter/data";
import {
  sectionPermissions,
  type DashboardSection,
  visibleSections,
} from "@/components/dashboard/sections";
import { loadNewRegistrationCount, NEW_REGISTRATION_DAYS } from "@/components/dashboard/training/data";
import { Card, PageHeader } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { requireTeamMember } from "@/lib/auth/gates";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireTeamMember(params, "/dashboard");
  const { locale } = await params;
  const [t, granted] = await Promise.all([
    getTranslations("DashboardContent"),
    grantedPermissions(sectionPermissions(), locale === "en" ? "en" : "ar"),
  ]);
  // The summary's numbers (§6.20): newsletter signups and course
  // registrations this week. Each only for a member who may read those rows,
  // with their own client (RLS). A failed count leaves its line out: it must
  // not take the page down.
  const [newSignups, newRegistrations] = await Promise.all([
    granted.has(PERMISSIONS.CONTENT_MANAGE)
      ? loadNewSignupCount().catch(() => {
          console.error("dashboard: newsletter signup count failed");
          return null;
        })
      : null,
    granted.has(PERMISSIONS.TRAINING_MANAGE)
      ? loadNewRegistrationCount().catch(() => {
          console.error("dashboard: course registration count failed");
          return null;
        })
      : null,
  ]);
  const sections = visibleSections(granted).filter(
    (section): section is DashboardSection & { key: Exclude<DashboardSection["key"], "home"> } =>
      section.key !== "home",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("home.title")}
        intro={sections.length > 0 ? t("home.intro") : undefined}
      />
      {sections.length === 0 ? (
        <Card as="section">
          <p className="text-text-secondary">{t("home.noSections")}</p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <Card as="li" compact key={section.key} className="relative">
              <h2 className="text-lg">
                <Link
                  href={section.href}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {t(`nav.${section.key}`)}
                </Link>
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {t(`home.sections.${section.key}`)}
              </p>
              {section.key === "newsletter" && newSignups !== null && (
                <p className="mt-2 text-sm font-semibold text-text">
                  {t("home.newSignups", { count: newSignups, days: NEW_SIGNUP_DAYS })}
                </p>
              )}
              {section.key === "training" && newRegistrations !== null && (
                <p className="mt-2 text-sm font-semibold text-text">
                  {t("home.newRegistrations", { count: newRegistrations, days: NEW_REGISTRATION_DAYS })}
                </p>
              )}
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
