import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit";
import { COURSES_CACHE_TAG, DOCUMENTS_CACHE_TAG } from "./cache-tags";
import { EMAIL_PAYLOADS, isOptionalEmailEvent } from "./email";
import { EMAIL_EVENTS, NEWSLETTER_STATUSES } from "./enums";
import { ERROR_CODES } from "./errors";
import {
  courseRegistrationListParamsSchema,
  customTrainingRequestListParamsSchema,
  newsletterSubscriberListParamsSchema,
} from "./lists";
import {
  COURSE_REGISTER_ERROR_CODES,
  COURSE_REGISTER_OUTCOMES,
  courseRegisterResponseSchema,
  myCourseRegistrationListSchema,
} from "./routes-client";
import {
  courseRegistrationListSchema,
  customTrainingRequestListSchema,
  newsletterSubscriberListSchema,
  updateCourseSchema,
} from "./routes-team";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const NOW = "2026-11-14T10:00:00.000Z";

describe("newsletter_confirm", () => {
  it("is an email event with an https confirm link", () => {
    expect(EMAIL_EVENTS).toContain("newsletter_confirm");
    const schema = EMAIL_PAYLOADS.newsletter_confirm;
    expect(schema.safeParse({ confirmUrl: "https://example.com/c?token=t" }).success).toBe(true);
    expect(schema.safeParse({ confirmUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it("is essential: notify_optional never skips it", () => {
    expect(isOptionalEmailEvent("newsletter_confirm")).toBe(false);
  });
});

describe("course registration", () => {
  it("has the four outcomes", () => {
    expect(COURSE_REGISTER_OUTCOMES).toEqual([
      "registered",
      "already_registered",
      "full",
      "closed",
    ]);
  });

  it("answers the refused outcomes with an error code", () => {
    expect(COURSE_REGISTER_ERROR_CODES).toEqual({
      full: "course_full",
      closed: "course_closed",
    });
    for (const code of Object.values(COURSE_REGISTER_ERROR_CODES)) {
      expect(ERROR_CODES).toContain(code);
    }
  });

  it.each([
    [{ outcome: "registered", seatsLeft: 0 }, true],
    [{ outcome: "already_registered", seatsLeft: null }, true],
    [{ outcome: "full", seatsLeft: 0 }, false],
    [{ outcome: "closed", seatsLeft: null }, false],
    [{ outcome: "registered", seatsLeft: -1 }, false],
    [{ outcome: "registered" }, false],
  ])("response %j → %s", (value, ok) => {
    expect(courseRegisterResponseSchema.safeParse(value).success).toBe(ok);
  });

  it("lists the client's own registrations", () => {
    const row = {
      id: ID,
      courseId: ID,
      slug: "c",
      type: "in_person",
      titleAr: "دورة",
      titleEn: null,
      startsAt: NOW,
      placeAr: "الرياض",
      placeEn: null,
      onlineUrl: null,
      registeredAt: NOW,
    };
    expect(myCourseRegistrationListSchema.safeParse({ registrations: [row] }).success).toBe(true);
    expect(
      myCourseRegistrationListSchema.safeParse({
        registrations: [{ ...row, onlineUrl: "http://example.com" }],
      }).success,
    ).toBe(false);
  });
});

describe("PATCH /api/admin/courses", () => {
  it("clears an optional field with null", () => {
    expect(updateCourseSchema.safeParse({ id: ID, seats: null }).success).toBe(true);
    expect(updateCourseSchema.safeParse({ id: ID, startsAt: null }).success).toBe(true);
  });

  it("never clears a required field", () => {
    for (const field of ["slug", "type", "status"]) {
      expect(updateCourseSchema.safeParse({ id: ID, [field]: null }).success).toBe(false);
    }
  });

  it("needs a field besides id, and a positive seat count", () => {
    expect(updateCourseSchema.safeParse({ id: ID }).success).toBe(false);
    expect(updateCourseSchema.safeParse({ id: ID, seats: 0 }).success).toBe(false);
  });
});

describe("Phase 5 lists", () => {
  it("newsletter subscribers: status filter, search, page", () => {
    expect(
      newsletterSubscriberListParamsSchema.parse({ status: "confirmed", search: "a@", page: "2" }),
    ).toMatchObject({ status: "confirmed", search: "a@", page: 2 });
    for (const status of NEWSLETTER_STATUSES) {
      expect(newsletterSubscriberListParamsSchema.safeParse({ status }).success).toBe(true);
    }
    expect(newsletterSubscriberListParamsSchema.safeParse({ status: "bounced" }).success).toBe(false);
  });

  it("course registrations: course filter, page", () => {
    expect(courseRegistrationListParamsSchema.parse({ course: ID, page: "3" })).toMatchObject({
      course: ID,
      page: 3,
    });
    expect(courseRegistrationListParamsSchema.safeParse({ course: "x" }).success).toBe(false);
  });

  it("custom training requests: page", () => {
    expect(customTrainingRequestListParamsSchema.parse({})).toMatchObject({ page: 1 });
    expect(customTrainingRequestListParamsSchema.safeParse({ status: "new" }).success).toBe(false);
  });

  it("row schemas never carry the token hash", () => {
    const subscriber = {
      id: ID,
      email: "a@example.com",
      locale: "ar",
      status: "pending",
      source: "footer",
      consentedAt: null,
      createdAt: NOW,
    };
    expect(newsletterSubscriberListSchema.safeParse({ subscribers: [subscriber], total: 1 }).success).toBe(true);
    expect(
      newsletterSubscriberListSchema.safeParse({
        subscribers: [{ ...subscriber, confirmTokenHash: "h" }],
        total: 1,
      }).success,
    ).toBe(false);
    expect(courseRegistrationListSchema.safeParse({ registrations: [], total: 0 }).success).toBe(true);
    expect(customTrainingRequestListSchema.safeParse({ requests: [], total: 0 }).success).toBe(true);
  });
});

describe("Phase 5 audit and cache keys", () => {
  it.each(["course.create", "course.update", "newsletter.export"])("has the action %s", (action) => {
    expect(AUDIT_ACTIONS).toContain(action);
  });

  it.each(["courses", "newsletter_subscribers", "custom_training_requests"])(
    "has the entity %s",
    (entity) => {
      expect(AUDIT_ENTITIES).toContain(entity);
    },
  );

  it("tags courses apart from documents", () => {
    expect(COURSES_CACHE_TAG).toBe("content:courses");
    expect(COURSES_CACHE_TAG).not.toBe(DOCUMENTS_CACHE_TAG);
  });
});
