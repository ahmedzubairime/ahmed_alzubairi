import { PERMISSIONS, type Permission } from "@repo/shared";

/** The KPIs of §6.23, in the order the page shows them. */
export const KPI_KEYS = [
  "consultations",
  "firstReply",
  "documentRequests",
  "registrations",
  "newsletter",
  "downloads",
  "signupShare",
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

/** The permission that shows each KPI (§5). Never a role name. */
export const KPI_PERMISSIONS: Record<KpiKey, Permission> = {
  consultations: PERMISSIONS.CONSULTATIONS_VIEW_ALL,
  firstReply: PERMISSIONS.CONSULTATIONS_VIEW_ALL,
  documentRequests: PERMISSIONS.DOCUMENT_REQUESTS_RECOMMEND,
  registrations: PERMISSIONS.TRAINING_MANAGE,
  newsletter: PERMISSIONS.CONTENT_MANAGE,
  downloads: PERMISSIONS.CONTENT_MANAGE,
  signupShare: PERMISSIONS.TEAM_MANAGE,
};

/** Any one of these opens the Statistics section. */
export const STATISTICS_PERMISSIONS: readonly Permission[] = [...new Set(Object.values(KPI_PERMISSIONS))];
