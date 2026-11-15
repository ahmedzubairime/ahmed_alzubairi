import { z } from "zod";
import {
  consultationKindSchema,
  consultationStatusSchema,
  courseTypeSchema,
  documentAccessModeSchema,
  documentOpenActionSchema,
  localeSchema,
  orgTypeSchema,
} from "./enums";
import {
  clerkUserIdSchema,
  hasAnyField,
  httpsUrlSchema,
  longTextSchema,
  shortTextSchema,
  utcDatetimeSchema,
  uuidSchema,
} from "./fields";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_NOTIFICATION_IDS,
  SIGNED_URL_TTL_SECONDS,
} from "./limits";
import type { ErrorCode } from "./errors";
import { createProfileRequestSchema } from "./profile";

/**
 * `PATCH /api/profile`. At least one field. Name, email and password stay with
 * Clerk.
 */
export const updateProfileRequestSchema = z
  .strictObject({
    phone: createProfileRequestSchema.shape.phone.optional(),
    orgType: orgTypeSchema.optional(),
    orgName: createProfileRequestSchema.shape.orgName,
    jobTitle: createProfileRequestSchema.shape.jobTitle,
    locale: localeSchema.optional(),
    timezone: createProfileRequestSchema.shape.timezone.optional(),
    notifyOptional: z.boolean().optional(),
  })
  .refine((body) => hasAnyField(body));

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** `POST /api/account/disable`. Takes no fields. */
export const disableAccountRequestSchema = z.strictObject({});

export type DisableAccountRequest = z.infer<typeof disableAccountRequestSchema>;

/** `closedConsultations`: how many open consultations the disable closed (§6.16). */
export const disableAccountResponseSchema = z.strictObject({
  ok: z.literal(true),
  closedConsultations: z.int().min(0),
});

export type DisableAccountResponse = z.infer<
  typeof disableAccountResponseSchema
>;

/**
 * `POST /api/notifications/read`. Marks the caller's own notifications read:
 * the ones in `ids`, or all of them when `ids` is left out.
 */
export const readNotificationsRequestSchema = z.strictObject({
  ids: z.array(uuidSchema).min(1).max(MAX_NOTIFICATION_IDS).optional(),
});

export type ReadNotificationsRequest = z.infer<
  typeof readNotificationsRequestSchema
>;

/** The dashboard counter (§6.21): the caller's unread notifications. */
export const notificationCounterSchema = z.strictObject({
  unread: z.int().min(0),
});

export type NotificationCounter = z.infer<typeof notificationCounterSchema>;

/** `POST /api/consultations` */
export const createConsultationRequestSchema = z.strictObject({
  serviceId: uuidSchema,
  title: shortTextSchema,
  description: longTextSchema,
  organization: shortTextSchema.optional(),
});

export type CreateConsultationRequest = z.infer<
  typeof createConsultationRequestSchema
>;

export const consultationSchema = z.strictObject({
  id: uuidSchema,
  kind: consultationKindSchema,
  clientId: clerkUserIdSchema,
  serviceId: uuidSchema.nullable(),
  title: z.string(),
  description: z.string(),
  organization: z.string().nullable(),
  status: consultationStatusSchema,
  assignedTo: clerkUserIdSchema.nullable(),
  firstReplyAt: utcDatetimeSchema.nullable(),
  closedAt: utcDatetimeSchema.nullable(),
  createdAt: utcDatetimeSchema,
});

export type Consultation = z.infer<typeof consultationSchema>;

/** `GET /api/consultations`. RLS scopes the rows. */
export const consultationListResponseSchema = z.strictObject({
  consultations: z.array(consultationSchema),
});

export type ConsultationListResponse = z.infer<
  typeof consultationListResponseSchema
>;

export const consultationMessageSchema = z.strictObject({
  id: uuidSchema,
  senderId: clerkUserIdSchema,
  senderName: z.string(),
  body: z.string().nullable(),
  createdAt: utcDatetimeSchema,
});

export type ConsultationMessage = z.infer<typeof consultationMessageSchema>;

/** Only `ready` attachments linked to a message. Never the `storage_key`. */
export const consultationAttachmentSchema = z.strictObject({
  id: uuidSchema,
  messageId: uuidSchema,
  fileName: z.string(),
  mime: z.string(),
  sizeBytes: z.int().positive(),
  uploadedBy: clerkUserIdSchema,
  createdAt: utcDatetimeSchema,
});

export type ConsultationAttachment = z.infer<
  typeof consultationAttachmentSchema
>;

export const meetingSchema = z.strictObject({
  id: uuidSchema,
  platform: z.string(),
  url: httpsUrlSchema,
  startsAt: utcDatetimeSchema,
  durationMinutes: z.int().positive(),
  createdAt: utcDatetimeSchema,
});

export type Meeting = z.infer<typeof meetingSchema>;

/** `GET /api/consultations/:id` */
export const consultationDetailResponseSchema = z.strictObject({
  consultation: consultationSchema,
  messages: z.array(consultationMessageSchema),
  attachments: z.array(consultationAttachmentSchema),
  meetings: z.array(meetingSchema),
});

export type ConsultationDetailResponse = z.infer<
  typeof consultationDetailResponseSchema
>;

/** `POST /api/consultations/:id/messages`. `body` may be left out only when files are attached. */
export const sendMessageRequestSchema = z
  .strictObject({
    body: longTextSchema.optional(),
    attachmentIds: z
      .array(uuidSchema)
      .max(MAX_ATTACHMENTS_PER_MESSAGE)
      .optional(),
  })
  .refine(
    (message) =>
      message.body !== undefined || (message.attachmentIds?.length ?? 0) > 0,
    { path: ["body"] },
  );

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

/** `POST /api/document-requests`. One request row per document. */
export const createDocumentRequestSchema = z.strictObject({
  documentIds: z.array(uuidSchema).min(1),
  purpose: longTextSchema,
});

export type CreateDocumentRequest = z.infer<typeof createDocumentRequestSchema>;

export const createDocumentRequestResponseSchema = z.strictObject({
  requestIds: z.array(uuidSchema).min(1),
});

export type CreateDocumentRequestResponse = z.infer<
  typeof createDocumentRequestResponseSchema
>;

/** `GET /api/documents/:id/open`. The route refuses `download` on a `view` document. */
export const documentOpenQuerySchema = z.strictObject({
  action: documentOpenActionSchema.default("view"),
});

export type DocumentOpenQuery = z.infer<typeof documentOpenQuerySchema>;

export const documentOpenResponseSchema = z.strictObject({
  url: z.url(),
  expiresInSeconds: z.literal(SIGNED_URL_TTL_SECONDS),
  accessMode: documentAccessModeSchema,
});

export type DocumentOpenResponse = z.infer<typeof documentOpenResponseSchema>;

/**
 * What `register_for_course` decides (§6.7). `full` and `closed` are refusals:
 * the route answers them with the `course_full` and `course_closed` error
 * codes (409). The other two are a 200.
 */
export const COURSE_REGISTER_OUTCOMES = [
  "registered",
  "already_registered",
  "full",
  "closed",
] as const;

export const courseRegisterOutcomeSchema = z.enum(COURSE_REGISTER_OUTCOMES);

export type CourseRegisterOutcome = z.infer<typeof courseRegisterOutcomeSchema>;

/** The refused outcomes and the error code each one answers with. */
export const COURSE_REGISTER_ERROR_CODES = {
  full: "course_full",
  closed: "course_closed",
} as const satisfies Partial<Record<CourseRegisterOutcome, ErrorCode>>;

/** Seats left after the call; null when the course has no seat limit. */
const seatsLeftSchema = z.int().min(0).nullable();

/** `POST /api/courses/:id/register`. Takes no fields. */
export const courseRegisterRequestSchema = z.strictObject({});

export type CourseRegisterRequest = z.infer<typeof courseRegisterRequestSchema>;

/** A registration twice is not an error: it answers `already_registered`. */
export const courseRegisterResponseSchema = z.strictObject({
  outcome: z.enum(["registered", "already_registered"]),
  seatsLeft: seatsLeftSchema,
});

export type CourseRegisterResponse = z.infer<
  typeof courseRegisterResponseSchema
>;

/**
 * One row of "دوراتي" (§6.7): the client's own registrations, a server read
 * through the client's own Supabase client (RLS scopes it). Titles and places
 * may be missing in one language.
 */
export const myCourseRegistrationSchema = z.strictObject({
  id: uuidSchema,
  courseId: uuidSchema,
  slug: z.string(),
  type: courseTypeSchema,
  titleAr: z.string().nullable(),
  titleEn: z.string().nullable(),
  startsAt: utcDatetimeSchema.nullable(),
  placeAr: z.string().nullable(),
  placeEn: z.string().nullable(),
  onlineUrl: httpsUrlSchema.nullable(),
  registeredAt: utcDatetimeSchema,
});

export type MyCourseRegistration = z.infer<typeof myCourseRegistrationSchema>;

export const myCourseRegistrationListSchema = z.strictObject({
  registrations: z.array(myCourseRegistrationSchema),
});

export type MyCourseRegistrationList = z.infer<
  typeof myCourseRegistrationListSchema
>;
