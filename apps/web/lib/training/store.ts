import "server-only";
import type { Database } from "@repo/db";
import { localeSchema, type Locale } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseOutcome, type Recipient, type RegisterRefusal, type TrainingStore } from "./handlers";

type Client = SupabaseClient<Database>;

const localeOf = (value: string): Locale => {
  const parsed = localeSchema.safeParse(value);
  return parsed.success ? parsed.data : "ar";
};

/** The fixed messages `register_for_course` raises (see its migration). */
const REFUSALS: readonly RegisterRefusal[] = ["not_a_client", "course_not_found"];

const filled = (value: string | null) => (value && value.trim() !== "" ? value : null);

/**
 * `user` carries the caller's token (RLS) for their own profile; it is null
 * for a visitor. `service` runs the function and the writes, and reads what
 * the emails need, only after the route checked who is calling (§9).
 */
export function createTrainingStore(
  user: Client | null,
  service: Client,
  userId: string | null,
): TrainingStore {
  return {
    async ownProfile() {
      if (!user || !userId) return null;
      const { data, error } = await user
        .from("profiles")
        .select("full_name, email, locale, role_id, notify_optional")
        .eq("clerk_user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`profile read failed: ${error.code}`);
      if (!data) return null;
      return {
        fullName: data.full_name,
        email: data.email,
        locale: localeOf(data.locale),
        isClient: data.role_id === null,
        notifyOptional: data.notify_optional,
      };
    },

    async register(courseId, clientId) {
      const { data, error } = await service.rpc("register_for_course", {
        p_course_id: courseId,
        p_client_id: clientId,
      });
      if (error) {
        const refusal = REFUSALS.find((message) => message === error.message);
        if (refusal) return refusal;
        throw new Error(`register_for_course failed: ${error.code}`);
      }
      const row = data[0];
      if (!row) throw new Error("register_for_course returned no row");
      return {
        outcome: parseOutcome(row.outcome),
        // The generated type says number, but the function answers null for a
        // course with no seat limit.
        seatsLeft: (row.seats_left as number | null) ?? null,
      };
    },

    async courseTitle(courseId) {
      const { data, error } = await service
        .from("courses")
        .select("title_ar, title_en")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw new Error(`courses read failed: ${error.code}`);
      const ar = filled(data?.title_ar ?? null);
      const en = filled(data?.title_en ?? null);
      // A course may have one language: the other falls back to it.
      const any = ar ?? en;
      return any ? { ar: ar ?? any, en: en ?? any } : null;
    },

    async insertCustomRequest(request, clientId) {
      const { data, error } = await service
        .from("custom_training_requests")
        .insert({
          client_id: clientId,
          org_name: request.orgName,
          trainee_count: request.traineeCount,
          topic: request.topic,
          suggested_date: request.suggestedDate,
          place: request.place ?? null,
          contact_email: request.contactEmail,
        })
        .select("id")
        .single();
      if (error) throw new Error(`custom_training_requests insert failed: ${error.code}`);
      return data.id;
    },

    async membersWith(permissions) {
      const roles = await service
        .from("role_permissions")
        .select("role_id")
        .in("permission", permissions);
      if (roles.error) throw new Error(`role_permissions read failed: ${roles.error.code}`);
      const roleIds = [...new Set(roles.data.map((row) => row.role_id))];
      if (roleIds.length === 0) return [];
      const members = await service
        .from("profiles")
        .select("clerk_user_id, email, locale")
        .eq("status", "active")
        .in("role_id", roleIds);
      if (members.error) throw new Error(`profiles read failed: ${members.error.code}`);
      return members.data.map(
        (row): Recipient => ({
          userId: row.clerk_user_id,
          email: row.email,
          locale: localeOf(row.locale),
        }),
      );
    },

    async notify(userIds, type, target) {
      if (userIds.length === 0) return;
      const { error } = await service.from("notifications").insert(
        userIds.map((id) => ({
          user_id: id,
          type,
          entity: target.entity,
          entity_id: target.entityId,
        })),
      );
      if (error) throw new Error(`notifications insert failed: ${error.code}`);
    },
  };
}
