import type { supabaseServer } from "@/lib/supabaseServer";

type Receipt = { id: string; mensalidade_id: string | null; dados_snapshot: unknown };
type Payment = { id: string; mensalidade_id: string | null; meta: unknown; valor_pago: unknown };
type Scope = { escolaId: string; alunoId: string; mensalidadeIds: readonly string[] };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** All consumers resolve the same persisted batch identity. Never infer a
 * link from date, name, amount alone or a different payment on the same month.
 * Receipts and settled payments are already scoped and active.
 */
export function mapIssuedBatchPaymentReceipts(
  receipts: readonly Receipt[], payments: readonly Payment[],
): Map<string, string> {
  const result = new Map<string, string>();
  const batches = new Map<string, Payment[]>();
  for (const payment of payments) {
    const meta = record(payment.meta);
    const batch = meta.batch_idempotency_key;
    if (typeof batch !== "string" || !batch.trim() || !(Number(payment.valor_pago) > 0)) continue;
    const group = batches.get(batch) ?? [];
    group.push(payment);
    batches.set(batch, group);
  }
  const byIssuer = new Map<string, Payment[]>();
  for (const group of batches.values()) {
    const issuers = group.filter(p => record(p.meta).emitir_recibo === true);
    if (issuers.length !== 1 || group.some(p => ![true,false].includes(record(p.meta).emitir_recibo as boolean))) continue;
    const issuer = issuers[0];
    const fingerprint = record(issuer.meta).batch_fingerprint;
    if (typeof fingerprint !== "string" || !fingerprint ||
        group.some(p => record(p.meta).batch_fingerprint !== fingerprint)) continue;
    byIssuer.set(issuer.id, group);
  }
  for (const receipt of receipts) {
    const snapshot = record(receipt.dados_snapshot);
    if (typeof snapshot.pagamento_id !== "string" || !Array.isArray(snapshot.itens_pagamento)) continue;
    const group = byIssuer.get(snapshot.pagamento_id);
    if (!group || group.length !== snapshot.itens_pagamento.length) continue;
    const mapped = new Set<string>();
    let valid = true;
    for (const [index, raw] of snapshot.itens_pagamento.entries()) {
      const item = record(raw);
      const matches = group.filter(p => record(p.meta).batch_index === index);
      const payment = matches[0];
      if (matches.length !== 1 || !payment || mapped.has(payment.id) ||
          Number(item.valor ?? item.amount ?? item.preco) !== Number(payment.valor_pago) ||
          (item.pagamento_id != null && item.pagamento_id !== payment.id) ||
          (item.tipo === "mensalidade" ? item.id !== payment.mensalidade_id || !payment.mensalidade_id
            : item.tipo !== "servico" || payment.mensalidade_id !== null)) {
        valid = false; break;
      }
      mapped.add(payment.id);
    }
    if (!valid || mapped.size !== group.length) continue;
    for (const id of mapped) if (!result.has(id)) result.set(id, receipt.id);
  }
  return result;
}

export function mapIssuedMonthlyReceipts(
  receipts: readonly Receipt[], payments: readonly Payment[], mensalidadeIds: readonly string[],
): Map<string, string> {
  const wanted = new Set(mensalidadeIds);
  const result = new Map<string, string>();
  const byPayment = mapIssuedBatchPaymentReceipts(receipts, payments);
  const byDocument = new Map<string, string[]>();
  for (const p of payments) {
    const doc = byPayment.get(p.id);
    if (!doc || !p.mensalidade_id || !wanted.has(p.mensalidade_id)) continue;
    const ids = byDocument.get(doc) ?? [];
    ids.push(p.mensalidade_id);
    byDocument.set(doc, ids);
  }
  for (const receipt of receipts) {
    const ids = byDocument.get(receipt.id) ?? [];
    if (receipt.mensalidade_id && wanted.has(receipt.mensalidade_id)) ids.push(receipt.mensalidade_id);
    for (const id of ids) if (!result.has(id)) result.set(id, receipt.id);
  }
  return result;
}

const PAGE_SIZE = 200;

/** One shared read-only resolver for the administrative dossier and student portal.
 * Use the caller's authenticated client: never service_role, never issuance.
 * Paginate within one school and student to avoid global scans and row limits.
 */
async function loadReceiptEvidence(
  db: Awaited<ReturnType<typeof supabaseServer>>, { escolaId, alunoId }: Pick<Scope,"escolaId"|"alunoId">,
): Promise<{ receipts: Receipt[]; payments: Payment[] }> {
  const receipts: Receipt[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db.from("documentos_emitidos")
      .select("id,mensalidade_id,dados_snapshot")
      .eq("escola_id", escolaId).eq("aluno_id", alunoId)
      .eq("tipo", "recibo").is("revoked_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    receipts.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  const payments: Payment[] = [];
  // Only load batch evidence if an issued snapshot actually contains items.
  if (receipts.some(receipt => Array.isArray(record(receipt.dados_snapshot).itens_pagamento))) {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await db.from("pagamentos")
        .select("id,mensalidade_id,meta,valor_pago")
        .eq("escola_id", escolaId).eq("aluno_id", alunoId).eq("status", "settled")
        .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      payments.push(...(data ?? []));
      if ((data?.length ?? 0) < PAGE_SIZE) break;
    }
  }
  return { receipts, payments };
}

export async function loadIssuedMonthlyReceipts(
  db: Awaited<ReturnType<typeof supabaseServer>>, scope: Scope,
): Promise<Map<string, string>> {
  if (!scope.mensalidadeIds.length) return new Map();
  const { receipts, payments } = await loadReceiptEvidence(db, scope);
  return mapIssuedMonthlyReceipts(receipts, payments, scope.mensalidadeIds);
}

export async function loadIssuedBatchPaymentReceipt(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  scope: Pick<Scope,"escolaId"|"alunoId"> & { pagamentoId: string },
): Promise<string | null> {
  const { receipts, payments } = await loadReceiptEvidence(db, scope);
  return mapIssuedBatchPaymentReceipts(receipts, payments).get(scope.pagamentoId) ?? null;
}
