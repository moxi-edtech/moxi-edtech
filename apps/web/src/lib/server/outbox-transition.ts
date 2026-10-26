import { createHash } from "node:crypto";

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

/** Matches documentos_emitidos_idempotency_pair_chk: an idempotency key
 * must be persisted together with a deterministic 16-128 char fingerprint.
 * The school/payment identity stays stable across outbox retries.
 */
export function paymentReceiptFingerprint(escolaId: string, pagamentoId: string): string {
  return createHash("sha256")
    .update(`pagamento_recibo:v1:${escolaId}:${pagamentoId}`)
    .digest("hex");
}

/**
 * Batch checkout issues exactly one consolidated receipt (for the final
 * item). Earlier items carry meta.emitir_recibo=false and must not be
 * independently fiscalized/printed by the asynchronous outbox consumer.
 * Legacy payments without the flag retain their original behavior.
 */
export function shouldEmitAutomaticPaymentReceipt(meta: unknown): boolean {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return true;
  return (meta as Record<string, unknown>).emitir_recibo !== false;
}
