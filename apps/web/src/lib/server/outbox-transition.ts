/**
 * A claimed event has already had attempts incremented by claim_outbox_events.
 * next_attempt_at is NOT NULL in production, including terminal sent/dead rows.
 */
export function buildOutboxTransition(input: {
  status: "sent" | "failed";
  attempts: number;
  maxAttempts: number | null | undefined;
  now: Date;
  lastError?: string | null;
}) {
  const attempts = Math.max(0, input.attempts);
  const maxAttempts = input.maxAttempts ?? 5;
  const dead = input.status === "failed" && attempts >= maxAttempts;
  const delayMinutes = Math.min(60, 2 ** attempts) * 5;
  const retryAt = new Date(input.now.getTime() + delayMinutes * 60_000);
  return {
    status: dead ? ("dead" as const) : input.status,
    processed_at: input.status === "sent" ? input.now.toISOString() : null,
    last_error: input.lastError ?? null,
    // Terminal events are never selected by claim_outbox_events; retain a valid
    // timestamp instead of writing NULL and violating outbox_events NOT NULL.
    next_attempt_at: input.status === "failed" && !dead
      ? retryAt.toISOString()
      : input.now.toISOString(),
    locked_at: null,
    locked_by: null,
  };
}

export function paymentReceiptKey(pagamentoId: string): string {
  return `pagamento_recibo:${pagamentoId}`;
}
