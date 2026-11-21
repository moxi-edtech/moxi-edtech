import { inngest } from "../client";
import { createClient } from "@supabase/supabase-js";
import { sendPushNotification } from "@/lib/webpush";
import type { Database } from "~types/supabase";
import type { PushSubscription } from "web-push";

// admin client with service role to bypass RLS and read subscriptions
const getAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key);
};

type WorkerResult = {
  id: string;
  result: {
    status: string;
    sent?: number;
    expired?: number;
  };
};

export const pushNotificationWorker = inngest.createFunction(
  {
    id: "push-notification-worker",
    name: "Push Notification Dispatcher",
    // Serialize cron and events to avoid two workers sending the same push.
    concurrency: 1,
    // SQL/trigger-created notifications are recovered even if no event was sent.
    triggers: [
      { event: "klasse/notification.push.requested" },
      { cron: "*/5 * * * *" },
    ],
  },
  async ({ event, step }) => {
    const isTargetedEvent = event?.name === "klasse/notification.push.requested";
    const input = isTargetedEvent
      ? (event.data as { escolaId?: unknown; eventoId?: unknown })
      : null;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const escolaId = typeof input?.escolaId === "string" ? input.escolaId : null;
    const eventoId = typeof input?.eventoId === "string" ? input.eventoId : null;

    // An invalid targeted event must never fall back to a global service-role scan.
    if (isTargetedEvent && (!escolaId || !eventoId || !uuid.test(escolaId) || !uuid.test(eventoId))) {
      return { skipped: "invalid_event" };
    }

    const admin = getAdminClient();

    // 1. Fetch committed, unprocessed notifications. Use the same query for
    // a targeted batch event and the low-frequency DB-created recovery path.
    const pendingNotifications = await step.run("fetch-pending-notifications", async () => {
      let query = admin
        .from("notificacoes")
        .select("id, escola_id, titulo, corpo, destinatario_id, action_url")
        .eq("push_processed", false)
        .order("created_at", { ascending: true })
        .limit(50);

      if (isTargetedEvent && escolaId && eventoId) {
        query = query.eq("escola_id", escolaId).eq("evento_id", eventoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });

    if (pendingNotifications.length === 0) return { message: "No pending notifications" };

    const results: WorkerResult[] = [];

    // 2. Process each notification
    for (const notification of pendingNotifications) {
      const pushResult = await step.run(`process-push-${notification.id}`, async () => {
        // Fetch user subscriptions
        const { data: subs, error: subsError } = await admin
          .from("aluno_push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", notification.destinatario_id)
          .eq("escola_id", notification.escola_id);

        if (subsError) throw subsError;
        if (!subs || subs.length === 0) {
          return { status: "no_subscriptions" };
        }

        let sentCount = 0;
        let expiredCount = 0;

        for (const sub of subs) {
          const pushSubscription: PushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          const result = await sendPushNotification(pushSubscription, {
            title: notification.titulo,
            body: notification.corpo || "",
            url: notification.action_url || "/aluno/dashboard",
          });

          if (typeof result === 'object' && result !== null && 'expired' in result && result.expired) {
            // Cleanup expired subscription
            await admin
              .from("aluno_push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
            expiredCount++;
          } else {
            sentCount++;
          }
        }

        return { status: "processed", sent: sentCount, expired: expiredCount };
      });

      // 3. Mark as processed in DB
      await step.run(`mark-processed-${notification.id}`, async () => {
        const { error } = await admin
          .from("notificacoes")
          .update({ 
            push_processed: true 
          } as Database["public"]["Tables"]["notificacoes"]["Update"])
          .eq("id", notification.id);
        
        if (error) throw error;
      });

      results.push({ id: notification.id, result: pushResult });
    }

    return { processed: results.length, details: results };
  }
);
