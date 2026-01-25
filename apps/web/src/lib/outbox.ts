import "server-only";

type OutboxPayload = Record<string, unknown>;

export async function enqueueOutboxEvent(
  supabase: unknown,
  {
    escolaId,
    eventType,
    payload,
    idempotencyKey,
    scope = "default",
  }: {
    escolaId: string;
    eventType: string;
    payload: OutboxPayload;
    idempotencyKey: string;
    scope?: "default" | "professor";
  }
): Promise<string | null> {
  const fn = scope === "professor" ? "enqueue_outbox_event_professor" : "enqueue_outbox_event";
  const params =
    scope === "professor"
      ? {
          p_escola_id: escolaId,
          p_event_type: eventType,
          p_payload: payload,
          p_idempotency_key: idempotencyKey,
        }
      : {
          p_escola_id: escolaId,
          p_topic: eventType,
          p_payload: payload,
          p_idempotency_key: idempotencyKey,
        };
  const { data, error } = await (supabase as any).rpc(fn, params);

  if (error) {
    throw new Error(error.message || "Falha ao enfileirar evento de outbox");
  }

  return data ?? null;
}

export async function markOutboxEventProcessed(supabase: unknown, eventId: string | null) {
  if (!eventId) return;
  await (supabase as any).rpc("mark_outbox_event_processed", {
    p_event_id: eventId,
  });
}

export async function markOutboxEventFailed(
  supabase: unknown,
  eventId: string | null,
  errorMessage: string
) {
  if (!eventId) return;
  await (supabase as any).rpc("mark_outbox_event_failed", {
    p_event_id: eventId,
    p_error: errorMessage,
  });
}
