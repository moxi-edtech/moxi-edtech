export type CheckoutPaymentState = "settled" | "pending" | "unknown";

export type CheckoutSettlement = {
  state: CheckoutPaymentState;
  statuses: string[];
};

const SETTLED_STATUSES = new Set([
  "settled",
  "confirmed",
  "confirmado",
  "concluido",
  "concluído",
  "pago",
  "paid",
  "succeeded",
  "approved",
]);

const PENDING_STATUSES = new Set([
  "pending",
  "pendente",
  "processing",
  "em_verificacao",
  "em_verificação",
  "awaiting_confirmation",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isPaymentSettledStatus(value: unknown): boolean {
  return SETTLED_STATUSES.has(normalizeStatus(value));
}

/**
 * Interpreta somente a verdade devolvida pelo backend.
 *
 * O endpoint de checkout devolve um único pagamento em `data` ou vários em
 * `pagamentos`. Documento dependente de pagamento só pode ser liberado quando
 * todas as linhas retornadas estão liquidadas. Qualquer estado pendente ou
 * desconhecido é conservadoramente não-confirmado.
 */
export function resolveCheckoutPaymentState(payload: unknown): CheckoutSettlement {
  const root = asRecord(payload);
  const batchRows = Array.isArray(root.pagamentos)
    ? root.pagamentos.map(asRecord)
    : [];
  const rows = batchRows.length > 0
    ? batchRows
    : Object.keys(asRecord(root.data)).length > 0
      ? [asRecord(root.data)]
      : [];

  const statuses = rows
    .map((row) => normalizeStatus(row.status))
    .filter(Boolean);

  if (statuses.length === 0) {
    return { state: "unknown", statuses };
  }

  if (statuses.every((status) => SETTLED_STATUSES.has(status))) {
    return { state: "settled", statuses };
  }

  if (statuses.some((status) => PENDING_STATUSES.has(status))) {
    return { state: "pending", statuses };
  }

  return { state: "unknown", statuses };
}
