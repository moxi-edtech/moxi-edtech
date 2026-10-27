import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { summarizeOverdueRematriculaDebt } from "@/lib/rematricula/debt";
import { recordAuditServer } from "@/lib/audit";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const uuid = z.string().uuid();
const confirmationSchema = z.object({
  matricula_id: uuid,
  ano_letivo_id: uuid,
  turma_id: uuid,
  pedido_id: uuid,
  confirmar: z.literal(true),
});

type CurrentEnrollment = {
  id: string;
  aluno_id: string;
  escola_id: string;
  turma_id: string | null;
  session_id: string | null;
  ano_letivo: number | null;
  status: string;
  ativo: boolean | null;
  origem_transicao_matricula_id: string | null;
};
type OrderRow = {
  id: string;
  status: string;
  matricula_id: string | null;
  valor_cobrado: number | string | null;
  contexto: Record<string, unknown> | null;
};

function canonicalEnrollmentStatus(value: string): "ativa" | "pendente" | "outro" {
  const text = value.toLowerCase().trim();
  if (["ativo", "ativa", "active"].includes(text)) return "ativa";
  if (text === "pendente") return "pendente";
  return "outro";
}

function orderForEnrollment(order: OrderRow, row: CurrentEnrollment, yearId: string): boolean {
  const ctx = order.contexto ?? {};
  return order.matricula_id === row.origem_transicao_matricula_id &&
    (ctx.ano_letivo_id === yearId || ctx.matricula_destino_id === row.id) &&
    (ctx.destino_turma_id === row.turma_id || ctx.matricula_destino_id === row.id);
}

async function context(studentId: string) {
  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: sessionError } = await db.auth.getUser();
  if (!user || sessionError) {
    return { error: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }) };
  }
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 }) };

  const authorization = await requireRoleInSchool({ supabase: db, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP] });
  if (authorization.error) return { error: authorization.error };
  const { data: student, error: studentError } = await db.from("alunos")
    .select("id").eq("id", studentId).eq("escola_id", escolaId).maybeSingle();
  if (studentError) return { error: NextResponse.json({ ok: false, error: "Não foi possível verificar o aluno." }, { status: 500 }) };
  if (!student) return { error: NextResponse.json({ ok: false, error: "Aluno não pertence a esta escola." }, { status: 404 }) };

  const activeYear = await resolveAnoLetivoScope(db, escolaId);
  if (!activeYear) return { error: NextResponse.json({ ok: false, error: "Ano letivo ativo não configurado." }, { status: 409 }) };

  const { data: enrollmentRows, error: enrollmentError } = await db.from("matriculas")
    .select("id, aluno_id, escola_id, turma_id, session_id, ano_letivo, status, ativo, origem_transicao_matricula_id")
    .eq("escola_id", escolaId).eq("aluno_id", studentId)
    .eq("ano_letivo", activeYear.ano).in("status", ["ativo", "ativa", "active", "pendente"])
    .limit(20);
  if (enrollmentError) return { error: NextResponse.json({ ok: false, error: "Falha ao consultar a matrícula corrente." }, { status: 500 }) };
  const enrollments = (enrollmentRows ?? []) as CurrentEnrollment[];
  const current = enrollments.length === 1 ? enrollments[0] : null;
  const inconsistent = enrollments.length > 1
    || Boolean(current && (current.session_id !== activeYear.id || !current.turma_id
      || current.ativo !== (canonicalEnrollmentStatus(current.status) === "ativa")));
  const { error: adminPermissionError } = await requireRoleInSchool({
    supabase: db, escolaId, roles: ["admin", "admin_escola"],
  });
  const canRectifyClass = !adminPermissionError;
  return { db, user, escolaId, activeYear, current, inconsistent, canRectifyClass, count: enrollments.length };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: studentId } = await params;
  if (!uuid.safeParse(studentId).success) return NextResponse.json({ ok: false, error: "Aluno inválido." }, { status: 400 });
  try {
    const ctx = await context(studentId);
    if (ctx.error) return ctx.error;
    const { db, escolaId, activeYear, current, inconsistent, canRectifyClass, count } = ctx;
    const result: Record<string, unknown> = {
      ok: true,
      anoLetivo: { id: activeYear!.id, ano: activeYear!.ano, label: activeYear!.ano + "/" + (activeYear!.ano + 1) },
      estado: inconsistent ? "reconciliacao" : !current ? "sem_matricula" : canonicalEnrollmentStatus(current.status),
      canRectifyClass: Boolean(canRectifyClass && !inconsistent && current && canonicalEnrollmentStatus(current.status) === "ativa"),
      canConfirm: false,
      reason: inconsistent
        ? "Existem matrículas duplicadas ou vínculos de ano/sessão inconsistentes. Requer reconciliação administrativa."
        : !current
          ? "O aluno não possui matrícula no ano letivo corrente. Inicie o processo de rematrícula no Balcão."
          : null,
      total: count,
      matricula: null,
    };
    if (current && !inconsistent) {
      const { data: turma, error: turmaError } = await db.from("turmas")
        .select("id, nome, classe_id, curso_id, session_id, ano_letivo, status_fecho")
        .eq("escola_id", escolaId).eq("id", current.turma_id).maybeSingle();
      if (turmaError || !turma || turma.session_id !== activeYear!.id || Number(turma.ano_letivo) !== activeYear!.ano) {
        result.estado = "reconciliacao";
        result.reason = "Turma de matrícula incompatível com o ano letivo corrente.";
        result.canRectifyClass = false;
      } else {
        const { data: classe } = turma.classe_id
          ? await db.from("classes").select("nome").eq("escola_id", escolaId).eq("id", turma.classe_id).maybeSingle()
          : { data: null };
        result.matricula = {
          id: current.id, status: current.status, turmaId: turma.id, turmaNome: turma.nome,
          classeNome: classe?.nome ?? null, ano: activeYear!.ano,
          anoLetivoId: activeYear!.id, origemId: current.origem_transicao_matricula_id,
        };
        if (canonicalEnrollmentStatus(current.status) === "pendente") {
          const { data: orders, error: ordersError } = await db.from("servico_pedidos")
            .select("id,status,matricula_id,valor_cobrado,contexto")
            .eq("escola_id", escolaId).eq("aluno_id", studentId)
            .eq("servico_codigo", "SERV_REMATRICULA")
            .in("status", ["pending_payment", "granted"])
            .order("created_at", { ascending: false }).limit(30);
          if (ordersError) {
            result.estado = "reconciliacao";
            result.reason = "Não foi possível verificar a confirmação financeira da matrícula.";
          } else {
            const matches = (orders ?? []).filter((order: OrderRow) => orderForEnrollment(order, current, activeYear!.id));
            // GET is a hint only. POST revalidates payment, debt, RAA and school scope.
            result.canConfirm = matches.length === 1 && turma.status_fecho === "aberto";
            result.pedidoId = matches.length === 1 ? matches[0].id : null;
            if (!result.canConfirm) {
              result.reason = "Reserva pendente. A confirmação exige um pedido de rematrícula associado e validado; utilize o Balcão ou a reconciliação.";
            }
          }
        }
      }
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    console.error("[CURRENT-ENROLLMENT][GET]", { message: error instanceof Error ? error.message : "UNEXPECTED" });
    return NextResponse.json({ ok: false, error: "Não foi possível consultar o ano corrente." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: studentId } = await params;
  if (!uuid.safeParse(studentId).success) return NextResponse.json({ ok: false, error: "Aluno inválido." }, { status: 400 });
  const parsed = confirmationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Confirmação inválida." }, { status: 400 });

  try {
    const ctx = await context(studentId);
    if (ctx.error) return ctx.error;
    const { db, escolaId, activeYear, current, inconsistent } = ctx;
    if (inconsistent || !current) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_RECONCILIATION_REQUIRED", error: "Não há uma reserva única e consistente para confirmar." }, { status: 409 });
    }
    const body = parsed.data;
    if (body.ano_letivo_id !== activeYear!.id || current.id !== body.matricula_id || current.turma_id !== body.turma_id) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_STALE", error: "A matrícula ou o ano letivo foram alterados. Atualize e reveja." }, { status: 409 });
    }
    if (canonicalEnrollmentStatus(current.status) === "ativa") {
      return NextResponse.json({ ok: true, idempotent: true, matricula_id: current.id });
    }
    if (canonicalEnrollmentStatus(current.status) !== "pendente" || current.ativo || !current.origem_transicao_matricula_id) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_INELIGIBLE", error: "A reserva não é elegível para confirmação direta. Utilize a reconciliação." }, { status: 409 });
    }
    const { data: origin, error: originError } = await db.from("matriculas")
      .select("id,ano_letivo,status")
      .eq("id", current.origem_transicao_matricula_id).eq("escola_id", escolaId).eq("aluno_id", studentId).maybeSingle();
    const { data: turma, error: turmaError } = await db.from("turmas")
      .select("id,session_id,ano_letivo,status_fecho").eq("id", current.turma_id).eq("escola_id", escolaId).maybeSingle();
    if (originError || turmaError || !origin || !turma || Number(origin.ano_letivo) >= activeYear!.ano ||
        turma.session_id !== activeYear!.id || Number(turma.ano_letivo) !== activeYear!.ano ||
        !["aberto", "open"].includes(String(turma.status_fecho).toLowerCase())) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_CONTEXT_INVALID", error: "Matrícula origem ou turma de destino incompatível." }, { status: 409 });
    }
    // Only a previously paid and issued enrollment may be resumed.
    // No payment, receipt, order, or fiscal document is created here.
    const { data: order, error: orderError } = await db.from("servico_pedidos")
      .select("id,status,matricula_id,valor_cobrado,contexto").eq("id", body.pedido_id)
      .eq("escola_id", escolaId).eq("aluno_id", studentId)
      .eq("servico_codigo", "SERV_REMATRICULA").maybeSingle();
    if (orderError || !order || !orderForEnrollment(order as OrderRow, current, activeYear!.id)) {
      return NextResponse.json({ ok: false, code: "ORDER_NOT_LINKED", error: "Pedido não pertence à reserva atual." }, { status: 409 });
    }
    const { data: intents, error: intentError } = await db.from("pagamento_intents")
      .select("id,amount,status").eq("escola_id", escolaId).eq("aluno_id", studentId)
      .eq("servico_pedido_id", order.id).eq("status", "settled").limit(30);
    const { data: payments, error: paymentsError } = await db.from("pagamentos")
      .select("id,valor_pago,status,meta")
      .eq("escola_id", escolaId).eq("aluno_id", studentId)
      .eq("status", "settled").limit(150);
    if (intentError || paymentsError) return NextResponse.json({ ok: false, error: "Não foi possível validar os pagamentos." }, { status: 503 });
    const creditedIntents = (intents ?? []).reduce((sum: number, i: { amount: number | string }) => sum + Number(i.amount || 0), 0);
    const orderPayments = (payments ?? []).filter((p: { meta?: Record<string, unknown> }) =>
      p.meta?.pedido_id === order.id || p.meta?.servico_pedido_id === order.id,
    );
    const creditedPayments = orderPayments.reduce((sum: number, p: { valor_pago: number | string }) => sum + Number(p.valor_pago || 0), 0);
    // A payment may exist in both ledgers: use MAX rather than summing.
    const credited = Math.max(creditedIntents, creditedPayments);
    const expectedAmount = Number(order.valor_cobrado ?? 0);
    if (!Number.isFinite(expectedAmount) || expectedAmount < 0 ||
        (expectedAmount > 0 && credited + 0.00001 < expectedAmount) ||
        (expectedAmount === 0 && order.status !== "granted")) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_PAYMENT_REQUIRED", error: "A taxa de rematrícula não está comprovadamente liquidada." }, { status: 409 });
    }
    const receiptIds = (order.contexto ?? {}) as Record<string, unknown>;
    const receiptId = typeof receiptIds.recibo_doc_id === "string" ? receiptIds.recibo_doc_id : null;
    if (!receiptId || !uuid.safeParse(receiptId).success) {
      return NextResponse.json({ ok: false, code: "ENROLLMENT_RECEIPT_PENDING", error: "Taxa liquidada, mas ainda não há recibo identificado no pedido. Reconcilie o recibo antes de confirmar." }, { status: 409 });
    }
    const { data: receipt, error: receiptError } = await db.from("documentos_emitidos")
      .select("id").eq("id", receiptId).eq("escola_id", escolaId)
      .eq("aluno_id", studentId).eq("tipo", "recibo").is("revoked_at", null).maybeSingle();
    if (receiptError || !receipt) return NextResponse.json({ ok: false, code: "ENROLLMENT_RECEIPT_INVALID", error: "Recibo da taxa não encontrado ou revogado." }, { status: 409 });

    // Canonical overdue-debt definition: Luanda date, positive unpaid balance,
    // and due date strictly in the past. Future fees never block enrollment.
    const { data: originMonthly, error: debtError } = await db.from("mensalidades")
      .select("status,valor_previsto,valor_pago_total,data_vencimento").eq("escola_id", escolaId)
      .eq("matricula_id", origin.id);
    if (debtError) return NextResponse.json({ ok: false, error: "Não foi possível validar os saldos do ano anterior." }, { status: 503 });
    const overdue = summarizeOverdueRematriculaDebt(originMonthly ?? []);
    if (overdue.total > 0) {
      return NextResponse.json({ ok: false, code: "REMATRICULA_DEBT_REQUIRED", error: "Existem mensalidades vencidas na matrícula de origem.", debt: { count: overdue.count, total: overdue.total } }, { status: 409 });
    }

    const { data: finished, error: finishError } = await db.rpc("finalizar_rematricula_balcao", {
      p_escola_id: escolaId,
      p_aluno_id: studentId,
      p_matricula_origem_id: origin.id,
      p_ano_letivo_id: activeYear!.id,
      p_destino_turma_id: current.turma_id,
      p_pedido_id: order.id,
    });
    if (finishError || !finished || finished.ok !== true || finished.matricula_id !== current.id) {
      console.warn("[CURRENT-ENROLLMENT][FINALIZE_GUARD]", { code: finishError?.code ?? null });
      return NextResponse.json({ ok: false, code: "ENROLLMENT_CANONICAL_REJECTED", error: "O RAA ou a validação canónica impediu a confirmação. Nenhuma nova cobrança foi criada." }, { status: 409 });
    }
    await recordAuditServer({
      escolaId, portal: "secretaria", acao: "MATRICULA_CORRENTE_CONFIRMADA",
      entity: "matriculas", entityId: current.id,
      details: { ano_letivo_id: activeYear!.id, pedido_id: order.id, origem_id: origin.id, confirma_sem_nova_cobranca: true },
    });
    return NextResponse.json({ ok: true, matricula_id: current.id, idempotent: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[CURRENT-ENROLLMENT][POST]", { message: error instanceof Error ? error.message : "UNEXPECTED" });
    return NextResponse.json({ ok: false, error: "Falha ao confirmar a matrícula. Consulte o estado atualizado antes de tentar novamente." }, { status: 500 });
  }
}
