import { z } from "zod";

export const ERROR_CODES = [
  "validation_failed",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "internal_error",
  "email_not_verified",
  "profile_incomplete",
  "file_too_large",
  "file_type_not_allowed",
  "too_many_attachments",
  // Phase 5: `POST /api/courses/:id/register` refusals (409)
  "course_full",
  "course_closed",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: errorCodeSchema,
    message: z.string().min(1),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
