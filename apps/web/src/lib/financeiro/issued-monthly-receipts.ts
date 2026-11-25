import type { supabaseServer } from "@/lib/supabaseServer";

type Receipt = { id: string; mensalidade_id: string | null; dados_snapshot: unknown };
type Payment = { id: string; mensalidade_id: string | null; meta: unknown; valor_pago: unknown };
type Scope = { escolaId: string; alunoId: string; mensalidadeIds: readonly string[] };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Documents must be active, scoped to one student/school and sorted newest first.
 * An explicit snapshot item alone is not proof of payment: verify the settled
 * member and its terminal issuer through the same persisted batch key.
 */
export function mapIssuedMonthlyReceipts(
  receipts: readonly Receipt[], payments: readonly Payment[], mensalidadeIds: readonly string[],
): Map<string, string> {
  const wanted = new Set(mensalidadeIds);
  const result = new Map<string, string>();
  const issuers = new Map<string, Payment[]>();
  const members = new Map<string, Set<string>>();
  for (const payment of payments) {
    if (!(Number(payment.valor_pago) > 0)) continue;
    const meta = record(payment.meta);
    const batch = meta.batch_idempotency_key;
    if (typeof batch !== "string" || !batch.trim()) continue;
    if (meta.emitir_recibo === true) {
      const group = issuers.get(batch) ?? [];
      group.push(payment);
      issuers.set(batch, group);
    } else if (meta.emitir_recibo === false && payment.mensalidade_id && wanted.has(payment.mensalidade_id)) {
      const group = members.get(batch) ?? new Set<string>();
      group.add(payment.mensalidade_id);
      members.set(batch, group);
    }
  }
  const verifiedBatches = new Map<string, Set<string>>();
  for (const [batch, group] of issuers) {
    const issuer = group[0];
    const memberIds = members.get(batch);
    if (group.length === 1 && issuer && memberIds) verifiedBatches.set(issuer.id, memberIds);
  }

  for (const receipt of receipts) {
    if (receipt.mensalidade_id && wanted.has(receipt.mensalidade_id) && !result.has(receipt.mensalidade_id)) {
      result.set(receipt.mensalidade_id, receipt.id);
    }
    const snapshot = record(receipt.dados_snapshot);
    const verified = typeof snapshot.pagamento_id === "string" ? verifiedBatches.get(snapshot.pagamento_id) : undefined;
    if (!verified || !Array.isArray(snapshot.itens_pagamento)) continue;
    for (const raw of snapshot.itens_pagamento) {
      const item = record(raw);
      if (item.tipo !== "mensalidade" || typeof item.id !== "string" || !verified.has(item.id)) continue;
      if (!result.has(item.id)) result.set(item.id, receipt.id);
    }
  }
  return result;
}

const PAGE_SIZE = 200;

/** One shared read-only resolver for the administrative dossier and student portal.
 * Use the caller's authenticated client: never service_role, never issuance.
 * Paginate within one school and student to avoid global scans and row limits.
 */
export async function loadIssuedMonthlyReceipts(
  db: Awaited<ReturnType<typeof supabaseServer>>, { escolaId, alunoId, mensalidadeIds }: Scope,
): Promise<Map<string, string>> {
  if (!mensalidadeIds.length) return new Map();
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
  return mapIssuedMonthlyReceipts(receipts, payments, mensalidadeIds);
}
