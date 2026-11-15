import "server-only";
import type { Database } from "@repo/db";
import { adminCourseSchema, type AdminCourse } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseStore, CourseWrite } from "./handlers";

type Client = SupabaseClient<Database>;

const COLUMNS =
  "id, slug, type, title_ar, title_en, description_ar, description_en, audience_ar, audience_en, starts_at, place_ar, place_en, online_url, seats, status";

const PG_UNIQUE_VIOLATION = "23505";

/** Postgres answers `+00:00`; the API's datetimes end in `Z`. */
const utc = (value: string | null) => (value === null ? null : new Date(value).toISOString());

/**
 * `user` carries the caller's token, so RLS decides what the list returns
 * (§9): courses and registrations are readable with `training.manage`.
 * `service` reads one row and writes, only after the route's permission check.
 */
export function createCourseStore(user: Client, service: Client): CourseStore {
  return {
    async list() {
      const [courses, registrations] = await Promise.all([
        user.from("courses").select(COLUMNS).order("starts_at", { ascending: false, nullsFirst: true }).order("slug"),
        user.from("course_registrations").select("course_id"),
      ]);
      if (courses.error) throw new Error(`courses read failed: ${courses.error.code}`);
      if (registrations.error) {
        throw new Error(`course_registrations read failed: ${registrations.error.code}`);
      }
      const counts = new Map<string, number>();
      for (const row of registrations.data) {
        counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
      }
      return courses.data.flatMap((row): AdminCourse[] => {
        const parsed = adminCourseSchema.safeParse({
          id: row.id,
          slug: row.slug,
          type: row.type,
          titleAr: row.title_ar,
          titleEn: row.title_en,
          descriptionAr: row.description_ar,
          descriptionEn: row.description_en,
          audienceAr: row.audience_ar,
          audienceEn: row.audience_en,
          startsAt: utc(row.starts_at),
          placeAr: row.place_ar,
          placeEn: row.place_en,
          onlineUrl: row.online_url,
          seats: row.seats,
          status: row.status,
          registrationCount: counts.get(row.id) ?? 0,
        });
        return parsed.success ? [parsed.data] : [];
      });
    },

    async get(id) {
      const { data, error } = await service
        .from("courses")
        .select(`${COLUMNS}, updated_at`)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(`courses read failed: ${error.code}`);
      if (!data) return null;
      const { id: _id, updated_at: version, ...row } = data;
      void _id;
      return { course: row as CourseWrite, version };
    },

    async insert(row) {
      const { data, error } = await service.from("courses").insert(row).select("id").single();
      if (error?.code === PG_UNIQUE_VIOLATION) return "slug_taken";
      if (error) throw new Error(`courses insert failed: ${error.code}`);
      return { id: data.id };
    },

    async update(id, changes, version) {
      // One statement: the row is written only if nobody changed it since it
      // was read (the `set_updated_at` trigger moves `updated_at` on every
      // write).
      const { data, error } = await service
        .from("courses")
        .update(changes)
        .eq("id", id)
        .eq("updated_at", version)
        .select("id");
      if (error?.code === PG_UNIQUE_VIOLATION) return "slug_taken";
      if (error) throw new Error(`courses update failed: ${error.code}`);
      if (data.length > 0) return "ok";
      const still = await service.from("courses").select("id").eq("id", id).maybeSingle();
      if (still.error) throw new Error(`courses read failed: ${still.error.code}`);
      return still.data ? "changed" : "gone";
    },

    async registrationCount(id) {
      const { count, error } = await service
        .from("course_registrations")
        .select("id", { count: "exact", head: true })
        .eq("course_id", id);
      if (error) throw new Error(`course_registrations read failed: ${error.code}`);
      return count ?? 0;
    },
  };
}
