import "server-only";
import { getMailer } from "@/lib/email/resend";

/**
 * Confirmed subscribers live in one Resend segment (§6.15; Resend's newer name
 * for an audience). `RESEND_AUDIENCE_ID` holds its id. Broadcasts are sent to
 * it from Resend, so only confirmed addresses are ever added.
 *
 * Logs carry Resend's error name only: never an address.
 */

export type AudienceSync = "synced" | "not_configured" | "failed";

/**
 * Adds a confirmed address to the segment, subscribed. Safe to repeat: an
 * address Resend already holds (one that unsubscribed and came back, or a
 * retry) is marked subscribed again and added to the segment.
 */
export async function addToAudience(email: string): Promise<AudienceSync> {
  const segmentId = process.env.RESEND_AUDIENCE_ID;
  const mailer = getMailer();
  if (!segmentId || !mailer) {
    console.error("newsletter: Resend keys or RESEND_AUDIENCE_ID not set, contact not synced");
    return "not_configured";
  }
  const { contacts } = mailer.resend;
  try {
    const created = await contacts.create({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    });
    if (!created.error) return "synced";

    // Most likely the contact exists already. Both calls below are idempotent.
    const updated = await contacts.update({ email, unsubscribed: false });
    if (updated.error) {
      console.error(`newsletter: contact not synced (${updated.error.name})`);
      return "failed";
    }
    const added = await contacts.segments.add({ email, segmentId });
    if (added.error) {
      console.error(`newsletter: contact not added to the segment (${added.error.name})`);
      return "failed";
    }
    return "synced";
  } catch {
    console.error("newsletter: contact not synced (network)");
    return "failed";
  }
}
