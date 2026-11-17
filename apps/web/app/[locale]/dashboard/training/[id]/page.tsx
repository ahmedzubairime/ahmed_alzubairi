import { uuidSchema } from "@repo/shared";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Refusal } from "@/components/dashboard/refusal";
import { CourseForm } from "@/components/dashboard/training/course-form";
import { loadCourse, trainingAccess } from "@/components/dashboard/training/data";
import { DeleteCourse } from "@/components/dashboard/training/delete-course";
import { courseTitle, registrationsPath, TRAINING_BASE } from "@/components/dashboard/training/format";
import { PublishToggle } from "@/components/dashboard/training/publish-toggle";
import { Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { requireTeamMember } from "@/lib/auth/gates";

type Params = Promise<{ locale: string; id: string }>;

/**
 * One course: edit, publish, its registrations and delete (with
 * `data.delete`). Opens with `training.manage`; every route checks its own
 * permission again.
 */
export default async function CoursePage({ params }: { params: Params }) {
  await requireTeamMember(params, "/dashboard/training/[id]");
  const access = await trainingAccess(params);
  if (!access.allowed) return <Refusal />;
  const { locale } = access;

  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) notFound();
  const [t, all, course] = await Promise.all([
    getTranslations("DashboardTraining"),
    getMessages(),
    loadCourse(id.data),
  ]);
  if (!course) notFound();
  const title = courseTitle(course, locale) ?? t("list.noTitle");

  return (
    <div className="space-y-6">
      <ButtonLink href={TRAINING_BASE} variant="quiet" size="sm">
        {t("detail.back")}
      </ButtonLink>
      {/* ConfirmTwice (delete) reads Workspace. */}
      <NextIntlClientProvider
        locale={locale}
        messages={{ DashboardTraining: all.DashboardTraining, Workspace: all.Workspace }}
      >
        <PageHeader
          title={title}
          actions={
            <Badge tone={course.status === "published" ? "strong" : "neutral"}>
              {t(`status.${course.status}`)}
            </Badge>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <PublishToggle id={course.id} title={title} status={course.status} />
          <ButtonLink href={registrationsPath({ course: course.id })} variant="secondary" size="sm">
            {t("list.registrations", { count: course.registrationCount })}
          </ButtonLink>
        </div>

        <Card as="section" aria-labelledby="course-details">
          <h2 id="course-details" className="mb-4 text-xl">
            {t("detail.edit")}
          </h2>
          {/* Keyed by the saved fields, so a refresh after a save resets the form to them.
              Status is left out: Publish/Unpublish must not discard unsaved edits. */}
          <CourseForm key={JSON.stringify({ ...course, status: undefined })} course={course} />
        </Card>

        {access.canDelete && (
          <div>
            <DeleteCourse id={course.id} title={title} registrationCount={course.registrationCount} />
          </div>
        )}
      </NextIntlClientProvider>
    </div>
  );
}
