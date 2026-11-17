import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Refusal } from "@/components/dashboard/refusal";
import { CourseForm } from "@/components/dashboard/training/course-form";
import { trainingAccess } from "@/components/dashboard/training/data";
import { TRAINING_BASE } from "@/components/dashboard/training/format";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

/** A new course. Opens with `training.manage`; `POST /api/admin/courses` checks it again. */
export default async function NewCoursePage({ params }: { params: Promise<{ locale: string }> }) {
  await requireTeamMember(params, "/dashboard/training/new");
  const access = await trainingAccess(params);
  if (!access.allowed) return <Refusal />;

  const [t, all] = await Promise.all([getTranslations("DashboardTraining"), getMessages()]);

  return (
    <div className="space-y-6">
      <ButtonLink href={TRAINING_BASE} variant="quiet" size="sm">
        {t("detail.back")}
      </ButtonLink>
      <PageHeader title={t("detail.newTitle")} intro={t("detail.newIntro")} />
      <Card as="section">
        <NextIntlClientProvider locale={access.locale} messages={{ DashboardTraining: all.DashboardTraining }}>
          <CourseForm />
        </NextIntlClientProvider>
      </Card>
    </div>
  );
}
