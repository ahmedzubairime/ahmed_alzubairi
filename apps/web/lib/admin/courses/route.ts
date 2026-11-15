import "server-only";
import { PERMISSIONS } from "@repo/shared";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { localeFromReferer } from "@/lib/auth/paths";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserClient } from "@/lib/supabase/user";
import { writeAudit, type AuditEntry } from "../audit";
import {
  baseError,
  requirePermission,
  type PermissionDeps,
} from "../permissions";
import {
  createCourse,
  listCourses,
  updateCourse,
  type CourseStore,
} from "./handlers";
import { createCourseStore } from "./store";

export type CoursesRouteDeps = {
  permission?: PermissionDeps;
  /** Called only after the permission check passed. */
  createStore: () => CourseStore;
  audit: (entry: AuditEntry) => Promise<void>;
  revalidate: (tag: string) => void;
};

const defaultDeps: CoursesRouteDeps = {
  createStore: () => createCourseStore(createUserClient(), createServiceClient()),
  audit: (entry) => writeAudit(entry),
  revalidate: (tag) => revalidateTag(tag, { expire: 0 }),
};

/** `GET`, `POST` and `PATCH /api/admin/courses`, each with `training.manage` (§8). */
export async function handleCoursesRequest(
  request: Request,
  deps: CoursesRouteDeps = defaultDeps,
): Promise<Response> {
  const locale = localeFromReferer(request.headers.get("referer"));
  try {
    const check = await requirePermission(PERMISSIONS.TRAINING_MANAGE, {
      locale,
      deps: deps.permission,
    });
    if (!check.ok) {
      return NextResponse.json(check.body, { status: check.status });
    }

    const handlerDeps = {
      locale,
      userId: check.userId,
      store: deps.createStore(),
      audit: deps.audit,
      revalidate: deps.revalidate,
    };

    if (request.method === "GET") {
      const result = await listCourses(handlerDeps);
      return NextResponse.json(result.body, { status: result.status });
    }

    const body: unknown = await request.json().catch(() => undefined);
    const result =
      request.method === "POST"
        ? await createCourse(body, handlerDeps)
        : await updateCourse(body, handlerDeps);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    // The error's message only (codes, never row data or the request body).
    console.error(
      `${request.method} /api/admin/courses`,
      error instanceof Error ? error.message : "error",
    );
    const failure = baseError("internal_error", 500, locale);
    return NextResponse.json(failure.body, { status: failure.status });
  }
}
