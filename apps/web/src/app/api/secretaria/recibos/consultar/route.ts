import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paramsSchema = z.object({
  mensalidade_id: z.string().uuid(),
});

const noStore = { "Cache-Control": "private, no-store, max-age=0" };

function readyReceipt(docId: string, source: "monthly" | "consolidated") {
  return NextResponse.json({
    ok: true,
    status: "ready",
    doc_id: docId,
    source,
    print_url: "/secretaria/documentos/" + encodeURIComponent(docId) + "/recibo/print",
  }, { headers: noStore });
}

/**
 * Read-only retrieval of the operational receipt for an already settled payment.
 *
 * The batch writer intentionally sets emitir_recibo=false for intermediate
 * payments and issues ONE receipt from its terminal payment, which can be a
 * service with mensalidade_id=NULL (e.g. a matrícula with paid mensalidades).
 * Searching only by mensalidade_id made those existing consolidated receipts
 * appear permanently "pending" in the Balcão.
 *
 * Never invokes payment or document emission RPCs.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = paramsSchema.safeParse({ mensalidade_id: params.get("mensalidade_id") });
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Mensalidade inválida." }, { status: 400 });

  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (!user || authError) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  const authorization = await requireRoleInSchool({
    supabase: db, escolaId, roles: [...K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;

  const { data: monthly, error: monthlyError } = await db.from("mensalidades")
    .select("id,aluno_id,escola_id,status,valor_pago_total")
    .eq("escola_id", escolaId).eq("id", parsed.data.mensalidade_id).maybeSingle();
  if (monthlyError) return NextResponse.json({ ok: false, error: "Falha ao validar mensalidade." }, { status: 500 });
  if (!monthly) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada nesta escola." }, { status: 404 });

  // Prefer the actual receipt for the requested mensalidade.
  const { data: document, error: documentError } = await db.from("documentos_emitidos")
    .select("id").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
    .eq("mensalidade_id", monthly.id).eq("tipo", "recibo")
    .is("revoked_at", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (documentError) {
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP][MONTHLY]", { code: documentError.code ?? null });
    return NextResponse.json({ ok: false, error: "Falha ao consultar documento." }, { status: 500 });
  }
  if (document) return readyReceipt(document.id, "monthly");

  // A suppressed intermediate item does not have its own receipt. Look up
  // the terminal payment in the SAME authorized student/school/batch, then
  // locate its previously issued document (including service-only receipts).
  const { data: payments, error: paymentsError } = await db.from("pagamentos")
    .select("id,meta").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
    .eq("mensalidade_id", monthly.id).eq("status", "settled")
    .order("created_at", { ascending: false }).limit(10);
  if (paymentsError) {
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP][PAYMENTS]", { code: paymentsError.code ?? null });
    return NextResponse.json({ ok: false, error: "Falha ao validar pagamento." }, { status: 500 });
  }

  const batchIds = new Set<string>();
  for (const payment of payments ?? []) {
    const meta = payment.meta;
    if (!meta || typeof meta !== "object" || Array.isArray(meta) || meta.emitir_recibo !== false) continue;
    const batchId = meta.batch_idempotency_key;
    if (typeof batchId === "string" && batchId.length >= 8 && batchId.length <= 200) {
      batchIds.add(batchId);
    }
    if (batchIds.size >= 3) break;
  }

  for (const batchId of batchIds) {
    const { data: issuers, error: issuerError } = await db.from("pagamentos")
      .select("id,mensalidade_id").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
      .eq("status", "settled")
      .contains("meta", { batch_idempotency_key: batchId, emitir_recibo: true })
      .limit(2);
    if (issuerError) {
      console.warn("[OPERATIONAL-RECEIPT-LOOKUP][BATCH]", { code: issuerError.code ?? null });
      return NextResponse.json({ ok: false, error: "Falha ao validar lote." }, { status: 500 });
    }
    if ((issuers ?? []).length > 1) {
      console.warn("[OPERATIONAL-RECEIPT-LOOKUP][AMBIGUOUS_BATCH]");
      return NextResponse.json({ ok: false, error: "Lote financeiro inconsistente. Solicite reconciliação." }, { status: 409 });
    }
    const issuer = issuers?.[0];
    if (!issuer) continue; // The terminal payment may not have committed yet.

    // Monthly terminal: the operational document is indexed by mensalidade_id.
    // Service terminal: the consolidated document references its payment ID
    // in dados_snapshot, not the intermediate mensalidade_id.
    const query = db.from("documentos_emitidos")
      .select("id").eq("escola_id", escolaId).eq("aluno_id", monthly.aluno_id)
      .eq("tipo", "recibo").is("revoked_at", null);
    const scopedQuery = issuer.mensalidade_id
      ? query.eq("mensalidade_id", issuer.mensalidade_id)
      : query.filter("dados_snapshot->>pagamento_id", "eq", issuer.id);
    const { data: batchReceipt, error: receiptError } = await scopedQuery
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (receiptError) {
      console.warn("[OPERATIONAL-RECEIPT-LOOKUP][CONSOLIDATED]", { code: receiptError.code ?? null });
      return NextResponse.json({ ok: false, error: "Falha ao consultar recibo consolidado." }, { status: 500 });
    }
    if (batchReceipt) return readyReceipt(batchReceipt.id, "consolidated");
  }

  // A pending document does not authorize checkout retry or new emission.
  return NextResponse.json({
    ok: true, status: "pending", doc_id: null, print_url: null,
    message: "O recibo operacional ainda está em preparação. Não repita o pagamento.",
  }, {
    status: 202,
    headers: { ...noStore, "Retry-After": "2" },
  });
}
