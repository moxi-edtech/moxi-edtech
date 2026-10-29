/** Only explicitly suppressed payments of an existing settled batch can
 * resolve to another payment's consolidated receipt. Never infer membership
 * from the same student or a close timestamp alone. */
export function candidateReceiptBatchIds(
  payments: ReadonlyArray<{ meta?: unknown }>,
  max = 3,
): string[] {
  const batches = new Set<string>();
  for (const payment of payments) {
    const meta = payment.meta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta)) continue;
    const row = meta as Record<string, unknown>;
    if (row.emitir_recibo !== false) continue;
    const batchId = row.batch_idempotency_key;
    if (typeof batchId !== "string" || batchId.length < 8 || batchId.length > 200) continue;
    batches.add(batchId);
    if (batches.size >= max) break;
  }
  return [...batches];
}
