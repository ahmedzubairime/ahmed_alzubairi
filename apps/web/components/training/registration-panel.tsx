import type { Locale } from "@repo/shared";
import { getTranslations } from "next-intl/server";
import { buttonClasses, ButtonLink } from "@/components/ui";
import { onboardingPath, signInPath } from "@/lib/auth/return-path";
import { courseState, type Course } from "@/lib/content/courses";
import { readViewer, type Viewer } from "./data";
import { coursePath, CUSTOM_TRAINING_PATH, MY_COURSES_PATH } from "./paths";
import { RegisterButton } from "./register-button";

const NOTE = "text-text-secondary";
/** Looks like a button and can't be used: "اكتملت المقاعد" (§6.7). */
const DISABLED =
  "inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-dashed border-text/40 px-4 font-semibold text-text-secondary";

function ExternalLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses({ variant: "secondary", className: "w-full" })}
    >
      {label}
      <span className="sr-only"> {hint}</span>
    </a>
  );
}

/**
 * What the course page offers this viewer, decided on the server for each
 * request: it reads the session, so the page renders it inside Suspense and
 * the rest of the page stays cached.
 *
 * Order matters. Someone registered sees that first, even when the course is
 * now full or over. A recorded course offers nothing. Then the course's own
 * state (full, closed), and only then who is asking.
 */
export async function RegistrationPanel({
  course,
  locale,
  viewer: given,
  now = new Date(),
}: {
  course: Pick<Course, "id" | "slug" | "type" | "startsAt" | "seatsLeft">;
  locale: Locale;
  /** For tests. The page lets the panel read it. */
  viewer?: Viewer;
  now?: Date;
}) {
  const t = await getTranslations({ locale, namespace: "Training" });
  const viewer = given ?? (await readViewer(course.id));
  const state = courseState(course, now);

  if (viewer.kind === "client" && viewer.registered) {
    return (
      <div className="space-y-3">
        <p role="status" className="font-semibold text-text">
          {t("register.registered")}
        </p>
        {viewer.onlineUrl && (
          <ExternalLink
            href={viewer.onlineUrl}
            label={t("course.openLink")}
            hint={t("course.opensInNewTab")}
          />
        )}
        <ButtonLink href={MY_COURSES_PATH} variant="quiet" className="w-full">
          {t("register.myCourses")}
        </ButtonLink>
      </div>
    );
  }

  if (state === "soon") return <p className={NOTE}>{t("register.soon")}</p>;
  if (course.type === "custom") {
    return (
      <div className="space-y-3">
        <p className={NOTE}>{t("register.custom")}</p>
        <ButtonLink href={CUSTOM_TRAINING_PATH} variant="secondary" className="w-full">
          {t("custom.linkFromCourse")}
        </ButtonLink>
      </div>
    );
  }
  if (state === "ended") {
    return (
      <p className="font-semibold text-text">
        {t("register.ended")}
      </p>
    );
  }
  if (state === "closed") return <p className={NOTE}>{t("register.closed")}</p>;
  if (state === "full") {
    return (
      <span aria-disabled="true" className={DISABLED}>
        {t("register.full")}
      </span>
    );
  }

  // Back to this same page after sign-in or onboarding (§6.16).
  const here = `/${locale}${coursePath(course.slug)}`;
  if (viewer.kind === "signed_out") {
    return (
      <div className="space-y-3">
        {/* A plain link: the path already carries the language. */}
        <a href={signInPath(locale, here)} className={buttonClasses({ className: "w-full" })}>
          {t("register.signIn")}
        </a>
        <p className={`text-sm ${NOTE}`}>{t("register.signInHint")}</p>
      </div>
    );
  }
  if (viewer.kind === "no_profile") {
    return (
      <a href={onboardingPath(locale, here)} className={buttonClasses({ className: "w-full" })}>
        {t("register.completeProfile")}
      </a>
    );
  }
  if (viewer.kind === "team") return <p className={NOTE}>{t("register.teamOnly")}</p>;

  return <RegisterButton courseId={course.id} />;
}
