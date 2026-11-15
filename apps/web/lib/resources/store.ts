import "server-only";
import type { Database } from "@repo/db";
import { resourceAccessSchema, SIGNED_URL_TTL_SECONDS, UPLOAD_TARGET_RULES } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResourceStore } from "./handlers";

const BUCKET = UPLOAD_TARGET_RULES.resource.bucket;

/**
 * Reads with the service client: the route is public, Arcjet has run, and
 * `storage_key` is readable by no other role (§7, §9).
 */
export function createResourceStore(service: SupabaseClient<Database>): ResourceStore {
  return {
    async findPublished(id) {
      const { data, error } = await service
        .from("resources")
        .select("storage_key, access, status")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw new Error(`resources read failed: ${error.code}`);
      if (!data || data.status !== "published") return null;
      const access = resourceAccessSchema.safeParse(data.access);
      if (!access.success) throw new Error("resources read failed: unknown access");
      return { storageKey: data.storage_key, access: access.data };
    },

    async signDownload(storageKey) {
      const { data, error } = await service.storage
        .from(BUCKET)
        .createSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS, { download: true });
      if (error) throw new Error(`resources createSignedUrl failed: ${error.message}`);
      return data.signedUrl;
    },
  };
}
