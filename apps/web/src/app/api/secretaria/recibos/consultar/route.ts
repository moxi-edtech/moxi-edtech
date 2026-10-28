import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { candidateReceiptBatchIds } from "@/lib/financeiro/receipt-batch-lookup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramsSchema = z.object({
  mensalidade_id: z.string().uuid().optional(),
  pagamento_id: z.string().uuid().optional(),
  escola_id: z.string().uuid().optional(),
});

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function readyReceipt(docId: string, source: "monthly" | "payment" | "consolidated") {
  return NextResponse.json({
    ok: true, status: "ready", doc_id: docId, source,
    print_url: "/secretaria/documentos/" + encodeURIComponent(docId) + "/recibo/print",
  }, { headers: noStore });
}

function pendingReceipt() {
  return NextResponse.json({
    ok: true, status: "pending", doc_id: null, print_url: null,
    message: "O recibo operacional ainda está em preparação. Não repita o pagamento.",
  }, { status: 202, headers: { ...noStore, "Retry-After": "2" } });
}

/** Each lookup is scoped to the authenticated school AND the payment's student. */
async function findIssuedDocument(
  db: any, escolaId: string, alunoId: string,
  reference: { mensalidadeId: string } | { paymentId: string },
): Promise<string | null> {
  const query = db.from("documentos_emitidos")
    .select("id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
    .eq("tipo", "recibo").is("revoked_at", null);
  const scoped = "mensalidadeId" in reference
    ? query.eq("mensalidade_id", reference.mensalidadeId)
    : query.filter("dados_snapshot->>pagamento_id", "eq", reference.paymentId);
  const { data, error } = await scoped
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP][DOCUMENT]", { code: error.code ?? null });
    throw new Error("DOCUMENT_LOOKUP_FAILED");
  }
  return data?.id ?? null;
}

/**
 * Batch financial writers suppress individual receipts (emitir_recibo=false)
 * and emit one consolidated document on the terminal payment. That payment
 * may be a service with mensalidade_id=NULL (including admissions).
 *
 * Never infer batch membership from dates or the same student. Both source
 * and issuer must be settled, within the SAME school, student and explicit
 * batch_idempotency_key. This function never creates a receipt.
 */
async function findConsolidatedReceipt(
  db: any, escolaId: string, alunoId: string, batchIds: string[],
): Promise<string | null> {
  for (const batchId of batchIds) {
    const { data: issuers, error } = await db.from("pagamentos")
      .select("id,mensalidade_id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
      .eq("status", "settled")
      .contains("meta", { batch_idempotency_key: batchId, emitir_recibo: true })
      .limit(2);
    if (error) {
      console.warn("[OPERATIONAL-RECEIPT-LOOKUP][BATCH]", { code: error.code ?? null });
      throw new Error("BATCH_LOOKUP_FAILED");
    }
    if ((issuers ?? []).length > 1) {
      console.warn("[OPERATIONAL-RECEIPT-LOOKUP][AMBIGUOUS_BATCH]");
      throw new Error("AMBIGUOUS_BATCH");
    }
    const issuer = issuers?.[0];
    if (!issuer) continue;
    const docId = issuer.mensalidade_id
      ? await findIssuedDocument(db, escolaId, alunoId, { mensalidadeId: issuer.mensalidade_id })
      : await findIssuedDocument(db, escolaId, alunoId, { paymentId: issuer.id });
    if (docId) return docId;
  }
  return null;
}

/** Read-only recovery. No payment, receipt-emission or fiscal RPC is called. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = paramsSchema.safeParse({
    mensalidade_id: params.get("mensalidade_id") ?? undefined,
    pagamento_id: params.get("pagamento_id") ?? undefined,
    escola_id: params.get("escola_id") ?? undefined,
  });
  if (!parsed.success || Boolean(parsed.data.mensalidade_id) === Boolean(parsed.data.pagamento_id)) {
    return NextResponse.json({ ok: false, error: "Informe uma mensalidade ou pagamento válido." }, { status: 400 });
  }

  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (!user || authError) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(db, user.id, parsed.data.escola_id);
  if (!escolaId || (parsed.data.escola_id && parsed.data.escola_id !== escolaId)) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }
  const authorization = await requireRoleInSchool({
    supabase: db, escolaId, roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP, 'admin_secretaria', 'diretor'],
  });
  if (authorization.error) return authorization.error;

  try {
    if (parsed.data.pagamento_id) {
      // Admission and service receipts can have no mensalidade_id at all.
      // Resolve by the settled payment, never by student alone.
      const { data: payment, error } = await db.from("pagamentos")
        .select("id,aluno_id,mensalidade_id,status,meta")
        .eq("escola_id", escolaId).eq("id", parsed.data.pagamento_id).maybeSingle();
      if (error) throw new Error("PAYMENT_LOOKUP_FAILED");
      if (!payment) return NextResponse.json({ ok: false, error: "Pagamento não encontrado nesta escola." }, { status: 404 });
      if (payment.status !== "settled") return pendingReceipt();

      const document = payment.mensalidade_id
        ? await findIssuedDocument(db, escolaId, payment.aluno_id, { mensalidadeId: payment.mensalidade_id })
        : await findIssuedDocument(db, escolaId, payment.aluno_id, { paymentId: payment.id });
      if (document) return readyReceipt(document, "payment");

      const batches = candidateReceiptBatchIds([payment]);
      const consolidated = await findConsolidatedReceipt(db, escolaId, payment.aluno_id, batches);
      return consolidated ? readyReceipt(consolidated, "consolidated") : pendingReceipt();
    }

    const { data: monthly, error: monthlyError } = await db.from("mensalidades")
      .select("id,aluno_id,escola_id,status,valor_pago_total")
      .eq("escola_id", escolaId).eq("id", parsed.data.mensalidade_id).maybeSingle();
    if (monthlyError) throw new Error("MONTHLY_LOOKUP_FAILED");
    if (!monthly) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada nesta escola." }, { status: 404 });

    const document = await findIssuedDocument(db, escolaId, monthly.aluno_id, { mensalidadeId: monthly.id });
    if (document) return readyReceipt(document, "monthly");

    const { data: payments, error: paymentsError } = await db.from("pagamentos")
      .select("id,meta").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
      .eq("mensalidade_id", monthly.id).eq("status", "settled")
      .order("created_at", { ascending: false }).limit(10);
    if (paymentsError) throw new Error("PAYMENTS_LOOKUP_FAILED");

    const batches = candidateReceiptBatchIds(payments ?? []);
    const consolidated = await findConsolidatedReceipt(db, escolaId, monthly.aluno_id, batches);
    return consolidated ? readyReceipt(consolidated, "consolidated") : pendingReceipt();
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP][FAILED]", { code });
    return NextResponse.json({
      ok: false,
      error: code === "AMBIGUOUS_BATCH"
        ? "Lote financeiro inconsistente. Solicite reconciliação."
        : "Não foi possível consultar o recibo. Tente novamente.",
    }, { status: code === "AMBIGUOUS_BATCH" ? 409 : 500, headers: noStore });
  }
}
