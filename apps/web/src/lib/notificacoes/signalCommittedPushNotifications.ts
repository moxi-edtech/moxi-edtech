import "server-only";

import { inngest } from "@/inngest/client";

/**
 * Best-effort fast path after the notification INSERT has committed.
 * DB-created notifications and failed sends remain covered by the recovery cron.
 *
 * One event per persisted "eventos" row, not one per recipient: this prevents
 * a large school-wide notification from exhausting the free Inngest quota.
 */
export async function signalCommittedPushNotifications(params: {
  escolaId: string;
  eventoId: string;
}): Promise<void> {
  const { escolaId, eventoId } = params;
  if (!escolaId || !eventoId) return;

  // In production the signing key alone cannot publish events.
  // If the event key isn't configured, the cron safety net still works.
  if (process.env.NODE_ENV === "production" && !process.env.INNGEST_EVENT_KEY) {
    return;
  }

  try {
    await inngest.send({
      id: `klasse-push-${eventoId}`,
      name: "klasse/notification.push.requested",
      data: { escolaId, eventoId },
    });
  } catch (error) {
    // Notification persistence must never fail because Inngest is unavailable.
    // The recovery cron will retry from the committed DB rows.
    console.warn("[push-signal] Event unavailable; recovery cron will scan pending rows.", error);
  }
}
