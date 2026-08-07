import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  AcademicYearContextError,
  assertAcademicYearEntity,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";
import { emitirComprovanteMatricula } from "@/lib/documentos/emitirComprovanteMatricula";
import { recordAuditServer } from "@/lib/audit";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  aluno_id: z.string().uuid(),
  matricula_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid(),
  destino_turma_id: z.string().uuid(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk"]),
  reference: z.string().trim().min(1).nullable().optional(),
  evidence_url: z.string().trim().min(1).nullable().optional(),
  gateway_ref: z.string().trim().min(1).nullable().optional(),
});

const SERVICE_CODE = "SERV_REMATRICULA";

function errorResponse(error: unknown) {
  if (error instanceof AcademicYearContextError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  throw error;
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json({ ok: false, error: "Idempotency-Key header é obrigatório" }, { status: 400 });
  }

  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || "Payload inválido" }, { status: 400 });
    }
    const body = parsed.data;

    let academicContext;
    try {
      academicContext = await resolveAcademicYearContext(supabase as any, {
        userId: user.id,
        requestedAcademicYearId: body.ano_letivo_id,
        operation: "WRITE",
      });
      await assertAcademicYearEntity(supabase as any, {
        table: "matriculas",
        entityId: body.matricula_id,
        escolaId,
        anoLetivoId: academicContext.anoLetivoId,
      });
      await assertAcademicYearEntity(supabase as any, {
        table: "turmas",
        entityId: body.destino_turma_id,
        escolaId,
        anoLetivoId: academicContext.anoLetivoId,
      });
    } catch (error) {
      return errorResponse(error);
    }

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, status, session_id")
      .eq("escola_id", escolaId)
      .eq("id", body.matricula_id)
      .eq("aluno_id", body.aluno_id)
      .eq("session_id", academicContext.anoLetivoId)
      .in("status", ["ativo", "ativa", "active"])
      .maybeSingle();
    if (!matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula activa do aluno não encontrada neste ano.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
    }

    const { data: service, error: serviceError } = await (supabase as any)
      .from("servicos_escola")
      .select("id, codigo, nome, valor_base, ativo")
      .eq("escola_id", escolaId)
      .eq("codigo", SERVICE_CODE)
      .maybeSingle();
    if (serviceError) throw serviceError;
    if (!service || !service.ativo || Number(service.valor_base) <= 0) {
      return NextResponse.json({ ok: false, error: "O emolumento de rematrícula ainda não está configurado.", code: "REMATRICULA_PRICE_NOT_CONFIGURED" }, { status: 409 });
    }

    const { data: debts, error: debtsError } = await supabase
      .from("mensalidades")
      .select("id, valor_previsto, valor_pago_total, status")
      .eq("escola_id", escolaId)
      .eq("matricula_id", body.matricula_id)
      .in("status", ["pendente", "pago_parcial"]);
    if (debtsError) throw debtsError;
    const outstanding = (debts ?? []).reduce((total, debt) => {
      const remaining = Number(debt.valor_previsto ?? 0) - Number(debt.valor_pago_total ?? 0);
      return total + Math.max(0, remaining);
    }, 0);
    if (outstanding > 0) {
      return NextResponse.json({ ok: false, error: "Regularize as dívidas do aluno antes de efectuar a rematrícula.", code: "REMATRICULA_DEBT_REQUIRED", outstanding }, { status: 409 });
    }

    const { data: pedidoExistente } = await (supabase as any)
      .from("servico_pedidos")
      .select("id, status, contexto")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("servico_codigo", SERVICE_CODE)
      .contains("contexto", { ano_letivo_id: academicContext.anoLetivoId })
      .in("status", ["pending_payment", "granted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pedidoExistente?.status === "granted") {
      const comprovante = await emitirComprovanteMatricula({
        supabase,
        escolaId,
        matriculaId: body.matricula_id,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: { portal: "secretaria", acao: "REMATRICULA_COMPROVANTE_REUTILIZADO" },
      });
      return NextResponse.json({ ok: true, pedido_id: pedidoExistente.id, rematricula: { matricula_id: body.matricula_id, ano_letivo_id: academicContext.anoLetivoId }, comprovante });
    }
    if (pedidoExistente?.status === "pending_payment") {
      return NextResponse.json({ ok: false, error: "Já existe uma rematrícula em pagamento para este aluno e ano.", code: "PAYMENT_IN_PROGRESS", pedido_id: pedidoExistente.id }, { status: 409 });
    }

    const { data: pedido, error: pedidoError } = await (supabase as any)
      .from("servico_pedidos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        matricula_id: body.matricula_id,
        servico_escola_id: service.id,
        status: "pending_payment",
        servico_codigo: SERVICE_CODE,
        servico_nome: service.nome,
        valor_cobrado: Number(service.valor_base),
        contexto: {
          origem: "rematricula_balcao",
          ano_letivo_id: academicContext.anoLetivoId,
          destino_turma_id: body.destino_turma_id,
          idempotency_key: idempotencyKey,
        },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pedidoError) throw pedidoError;

    const paymentUrl = new URL("/api/secretaria/balcao/pagamentos", request.url);
    const paymentResponse = await fetch(paymentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        aluno_id: body.aluno_id,
        mensalidade_id: null,
        ano_letivo_id: academicContext.anoLetivoId,
        valor: Number(service.valor_base),
        metodo: body.metodo,
        reference: body.reference ?? null,
        evidence_url: body.evidence_url ?? null,
        gateway_ref: body.gateway_ref ?? null,
        meta: {
          origem: "rematricula_balcao",
          servico_codigo: SERVICE_CODE,
          pedido_id: pedido.id,
          rematricula_ano_letivo_id: academicContext.anoLetivoId,
        },
      }),
    });
    const paymentJson = await paymentResponse.json().catch(() => null);
    if (!paymentResponse.ok || !paymentJson?.ok) {
      await (supabase as any).from("servico_pedidos").update({ status: "canceled", reason_code: "PAYMENT_FAILED", reason_detail: paymentJson?.error || "Falha no pagamento" }).eq("id", pedido.id).eq("escola_id", escolaId);
      return NextResponse.json({ ok: false, error: paymentJson?.error || "Falha ao registar o pagamento.", code: "PAYMENT_REQUIRED" }, { status: 400 });
    }

    const { error: turmaUpdateError } = await supabase
      .from("matriculas")
      .update({ turma_id: body.destino_turma_id })
      .eq("id", body.matricula_id)
      .eq("escola_id", escolaId)
      .eq("session_id", academicContext.anoLetivoId);
    if (turmaUpdateError) {
      await (supabase as any).from("servico_pedidos").update({ status: "pending_payment", reason_code: "REMATRICULA_RECONCILIATION_REQUIRED", reason_detail: turmaUpdateError.message }).eq("id", pedido.id).eq("escola_id", escolaId);
      return NextResponse.json({ ok: false, error: "Pagamento confirmado, mas a matrícula precisa de reconciliação.", code: "REMATRICULA_RECONCILIATION_REQUIRED", payment: paymentJson.data ?? null, pedido_id: pedido.id }, { status: 409 });
    }

    await (supabase as any).from("servico_pedidos").update({ status: "granted", contexto: { origem: "rematricula_balcao", ano_letivo_id: academicContext.anoLetivoId, destino_turma_id: body.destino_turma_id, idempotency_key: idempotencyKey, pagamento_id: paymentJson.data?.id ?? null } }).eq("id", pedido.id).eq("escola_id", escolaId);

    const comprovante = await emitirComprovanteMatricula({
      supabase,
      escolaId,
      matriculaId: body.matricula_id,
      dataHoraEfetivacao: new Date().toISOString(),
      createdBy: user.id,
      audit: { portal: "secretaria", acao: "REMATRICULA_COMPROVANTE_EMITIDO" },
    });
    if (!comprovante.ok) {
      return NextResponse.json({ ok: false, error: "Rematrícula e pagamento concluídos, mas o comprovante precisa ser reemitido.", code: "DOCUMENT_PENDING", pedido_id: pedido.id, payment: paymentJson.data ?? null, comprovante }, { status: 202 });
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "REMATRICULA_BALCAO_CONCLUIDA",
      entity: "matriculas",
      entityId: body.matricula_id,
      details: {
        aluno_id: body.aluno_id,
        ano_letivo_id: academicContext.anoLetivoId,
        destino_turma_id: body.destino_turma_id,
        pedido_id: pedido.id,
        pagamento_id: paymentJson.data?.id ?? null,
        documento_id: comprovante.docId,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      pedido_id: pedido.id,
      rematricula: { matricula_id: body.matricula_id, ano_letivo_id: academicContext.anoLetivoId, turma_id: body.destino_turma_id },
      pagamento: paymentJson.data ?? null,
      comprovante,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return errorResponse(error);
    const message = error instanceof Error ? error.message : String(error);
    console.error("[REMATRICULA-BALCAO]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
