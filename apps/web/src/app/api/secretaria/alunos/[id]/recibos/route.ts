import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { toOperationalReceiptHistoryItem } from "@/lib/financeiro/operational-receipt-history";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const querySchema = z.object({
  alunoId: z.string().uuid(),
  escolaId: z.string().uuid(),
  offset: z.coerce.number().int().min(0).max(50000),
  paymentsOffset: z.coerce.number().int().min(0).max(50000),
});

/**
 * Read-only operational receipt history for the full student dossier
 * (also rendered by Command Center).
 *
 * This route NEVER calls emit_* RPCs, creates receipts, or reads fiscal
 * documents. Access must pass both the user's real school role and the
 * tenant/student filter; RLS provides an additional database guard.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alunoId } = await params;
  const search = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    alunoId,
    escolaId: search.get("escola_id"),
    offset: search.get("offset") ?? "0",
    paymentsOffset: search.get("pagamentos_offset") ?? "0",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos." }, { status: 400 });
  }

  const supabase = await supabaseServerTyped<Database>();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  }

  const { alunoId: studentId, escolaId: requestedSchoolId, offset, paymentsOffset } = parsed.data;
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedSchoolId);
  if (!escolaId || escolaId !== requestedSchoolId) {
    return NextResponse.json({ ok: false, error: "Sem permissão." }, { status: 403 });
  }

  // Same financial-document roles as the existing receipt print endpoint.
  const access = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: [
      "secretaria", "financeiro", "secretaria_financeiro",
      "admin_financeiro", "admin_secretaria",
      "admin", "admin_escola", "staff_admin", "diretor",
    ],
  });
  if (access.error) return access.error;

  const { data: student, error: studentError } = await supabase
    .from("alunos")
    .select("id")
    .eq("id", studentId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (studentError) {
    return NextResponse.json({ ok: false, error: "Falha ao verificar o aluno." }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json({ ok: false, error: "Aluno não encontrado." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("documentos_emitidos")
    .select("id, created_at, mensalidade_id, numero_sequencial, dados_snapshot")
    .eq("escola_id", escolaId)
    .eq("aluno_id", studentId)
    .eq("tipo", "recibo")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE);

  if (error) {
    console.error("[RECIBOS-HISTORICO][READ_FAILED]", { code: error.code ?? null });
    return NextResponse.json({ ok: false, error: "Falha ao consultar os recibos." }, { status: 500 });
  }

  // Separate, persistent settlement history. A receipt may not exist yet
  // (or may belong to the terminal payment of a consolidated batch), so
  // listing only documentos_emitidos hides those legitimate transactions.
  // Never expose payment metadata, fiscal records or identifiers from another
  // school/student; the lookup link re-checks all permissions.
  const { data: paymentRows, error: paymentsError } = await supabase
    .from("pagamentos")
    .select("id, created_at, valor_pago, mensalidade_id")
    .eq("escola_id", escolaId)
    .eq("aluno_id", studentId)
    .eq("status", "settled")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(paymentsOffset, paymentsOffset + PAGE_SIZE);

  if (paymentsError) {
    console.warn("[RECIBOS-HISTORICO][PAYMENTS_READ_FAILED]", { code: paymentsError.code ?? null });
    return NextResponse.json({ ok: false, error: "Falha ao consultar os pagamentos." }, { status: 500 });
  }

  const rows = data ?? [];
  const payments = paymentRows ?? [];
  const hasMore = rows.length > PAGE_SIZE;
  const hasMorePayments = payments.length > PAGE_SIZE;
  return NextResponse.json({
    ok: true,
    recibos: rows.slice(0, PAGE_SIZE).map(toOperationalReceiptHistoryItem),
    nextOffset: hasMore ? offset + PAGE_SIZE : null,
    pagamentos: payments.slice(0, PAGE_SIZE).map((payment) => ({
      id: payment.id,
      registeredAt: payment.created_at,
      amount: Number(payment.valor_pago ?? 0),
      kind: payment.mensalidade_id ? "mensalidade" : "servico",
    })),
    nextPaymentOffset: hasMorePayments ? paymentsOffset + PAGE_SIZE : null,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
