import type { CreateCourse, UpdateCourse } from "@repo/shared";
import { sendJson } from "@/components/dashboard/documents/send";

/** `POST /api/admin/courses` (`training.manage`). */
export function createCourse(body: CreateCourse, fetchImpl?: typeof fetch) {
  return sendJson<{ id: string }>("POST", "/api/admin/courses", body, fetchImpl);
}

/** `PATCH /api/admin/courses` (`training.manage`). */
export function updateCourse(body: UpdateCourse, fetchImpl?: typeof fetch) {
  return sendJson("PATCH", "/api/admin/courses", body, fetchImpl);
}

/**
 * `DELETE /api/admin/courses/:id` (`data.delete`), with the row id again in
 * the body as the route's confirmation (§8).
 */
export function deleteCourse(id: string, fetchImpl?: typeof fetch) {
  return sendJson("DELETE", `/api/admin/courses/${encodeURIComponent(id)}`, { confirm: id }, fetchImpl);
}
