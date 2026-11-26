import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { K12_FINANCEIRO_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { loadIssuedBatchPaymentReceipt, loadIssuedMonthlyReceipts } from "@/lib/financeiro/issued-monthly-receipts";

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
      if (payment.status !== "settled") {
        // A non-settled payment is NOT a paid transaction awaiting its receipt.
        // Return a distinct state so the operator never mistakes a voided or
        // unconfirmed charge for a completed checkout.
        return NextResponse.json({
          ok: false,
          status: "not_settled",
          error: "Pagamento não liquidado. Verifique o estado antes de efetuar outra cobrança.",
        }, { status: 409, headers: noStore });
      }

      // An intermediate payment explicitly suppressed its own receipt.
      // Resolve its actual issuer FIRST: a direct document on the same
      // mensalidade could belong to an earlier, different payment.
      if (payment.meta?.batch_idempotency_key || payment.meta?.emitir_recibo === false) {
        const consolidated = await loadIssuedBatchPaymentReceipt(db, {
          escolaId, alunoId: payment.aluno_id, pagamentoId: payment.id,
        });
        return consolidated ? readyReceipt(consolidated, "consolidated") : pendingReceipt();
      }

      // An independent payment has its own document, indexed by the
      // mensualidade or the service payment ID.
      const document = payment.mensalidade_id
        ? await findIssuedDocument(db, escolaId, payment.aluno_id, { mensalidadeId: payment.mensalidade_id })
        : await findIssuedDocument(db, escolaId, payment.aluno_id, { paymentId: payment.id });
      return document ? readyReceipt(document, "payment") : pendingReceipt();
    }

    const { data: monthly, error: monthlyError } = await db.from("mensalidades")
      .select("id,aluno_id,escola_id,status,valor_pago_total")
      .eq("escola_id", escolaId).eq("id", parsed.data.mensalidade_id).maybeSingle();
    if (monthlyError) throw new Error("MONTHLY_LOOKUP_FAILED");
    if (!monthly) return NextResponse.json({ ok: false, error: "Mensalidade não encontrada nesta escola." }, { status: 404 });

    const receipts = await loadIssuedMonthlyReceipts(db, {
      escolaId, alunoId: monthly.aluno_id, mensalidadeIds: [monthly.id],
    });
    const document = receipts.get(monthly.id);
    return document ? readyReceipt(document, "monthly") : pendingReceipt();
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    console.warn("[OPERATIONAL-RECEIPT-LOOKUP][FAILED]", { code });
    return NextResponse.json({
      ok: false,
      error: "Não foi possível consultar o recibo. Tente novamente.",
    }, { status: 500, headers: noStore });
  }
}
