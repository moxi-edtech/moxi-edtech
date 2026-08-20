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
import { normalizeAnoLetivo } from "@/lib/financeiro/tabela-preco";
import { resolveValorConfirmacao } from "@/lib/financeiro/resolve-confirmacao";
import { isMensalidadeVencida, todayInLuanda } from "@/lib/financeiro/mensalidade-vencida";
import { resolveRematriculaWindow } from "@/lib/secretaria/rematricula-window";

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
  notas_lancar_depois: z.boolean().optional(),
});

const SERVICE_CODE = "SERV_REMATRICULA";

function classeNumero(classe: any): number | null {
  const numero = Number(classe?.numero);
  if (Number.isFinite(numero) && numero > 0) return numero;
  const match = String(classe?.nome || "").match(/(\d{1,2})\s*(?:ª|a)?/i);
  return match ? Number(match[1]) : null;
}

function errorResponse(error: unknown) {
  if (error instanceof AcademicYearContextError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  throw error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;
    for (const key of ["message", "error", "erro", "details", "hint"]) {
      if (typeof row[key] === "string" && row[key].trim()) return row[key] as string;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro estruturado não serializável";
    }
  }
  return String(error);
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
        table: "turmas",
        entityId: body.destino_turma_id,
        escolaId,
        anoLetivoId: academicContext.anoLetivoId,
      });
      const rematriculaWindow = await resolveRematriculaWindow(
        supabase,
        escolaId,
        Number(academicContext.anoLetivoLabel.slice(0, 4)),
      );
      if (!rematriculaWindow.open) {
        return NextResponse.json({
          ok: false,
          error: "O período de rematrícula não está aberto para este ano letivo.",
          code: "REMATRICULA_WINDOW_CLOSED",
        }, { status: 409 });
      }
    } catch (error) {
      return errorResponse(error);
    }

    let { data: matricula } = await supabase
      .from("matriculas")
      .select("id, aluno_id, turma_id, status, session_id, ano_letivo")
      .eq("escola_id", escolaId)
      .eq("id", body.matricula_id)
      .eq("aluno_id", body.aluno_id)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada", "transferido"])
      .maybeSingle();
    if (!matricula) {
      return NextResponse.json({ ok: false, error: "Matrícula de origem do aluno não encontrada.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
    }

    const targetAnoLetivoAno = Number(academicContext.anoLetivoLabel.slice(0, 4));
    if (Number(matricula.ano_letivo ?? 0) >= targetAnoLetivoAno) {
      const { data: matriculaAnterior } = await supabase
        .from("matriculas")
        .select("id, aluno_id, turma_id, status, session_id, ano_letivo")
        .eq("escola_id", escolaId)
        .eq("aluno_id", body.aluno_id)
        .lt("ano_letivo", targetAnoLetivoAno)
        .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada", "transferido"])
        .order("ano_letivo", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!matriculaAnterior) {
        return NextResponse.json({ ok: false, error: "Não foi possível identificar a matrícula anterior para esta operação.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
      }
      matricula = matriculaAnterior;
    }
    const origemMatriculaId = String(matricula.id);
    const { data: matriculaDestino } = await supabase
      .from("matriculas")
      .select("id, turma_id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("ano_letivo", targetAnoLetivoAno)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
      .limit(1)
      .maybeSingle();
    const { data: reclassificacao } = matriculaDestino
      ? await (supabase as any)
          .from("matricula_reclassificacoes")
          .select("id, tipo, status")
          .eq("escola_id", escolaId)
          .eq("matricula_id", matriculaDestino.id)
          .eq("status", "aguardando_destino")
          .maybeSingle()
      : { data: null };

    const [{ data: turmaOrigem }, { data: turmaDestino }] = await Promise.all([
      matricula.turma_id
        ? supabase.from("turmas").select("id, classe_id, curso_id").eq("escola_id", escolaId).eq("id", matricula.turma_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("turmas").select("id, classe_id, curso_id").eq("escola_id", escolaId).eq("id", body.destino_turma_id).maybeSingle(),
    ]);
    const classeIds = [turmaOrigem?.classe_id, turmaDestino?.classe_id].filter((id): id is string => Boolean(id));
    const { data: classes } = classeIds.length > 0
      ? await supabase.from("classes").select("id, nome, numero").eq("escola_id", escolaId).in("id", classeIds)
      : { data: [] };
    const classeById = new Map((classes || []).map((classe: any) => [classe.id, classe]));
    const numeroOrigem = classeNumero(classeById.get(turmaOrigem?.classe_id));
    const numeroDestino = classeNumero(classeById.get(turmaDestino?.classe_id));
    // Uma matrícula destino existente já passou pela promoção/reclassificação.
    // O Balcão apenas cobra a reconfirmação ou resolve a decisão de finalista.
    if (!matriculaDestino) {
      const resultado = await supabase
        .from("historico_anos")
        .select("resultado_final")
        .eq("escola_id", escolaId)
        .eq("aluno_id", body.aluno_id)
        .eq("ano_letivo", Number(matricula.ano_letivo))
        .maybeSingle();
      const resultadoFinal = String(resultado.data?.resultado_final || "").toLowerCase();
      const reprovado = ["reprovado", "reprovada", "reprovado_por_faltas"].includes(String(matricula.status).toLowerCase()) || resultadoFinal.includes("reprov");
      const notasPendentes = !reprovado && !resultadoFinal.includes("aprov");
      if (notasPendentes && body.notas_lancar_depois !== true) {
        return NextResponse.json({ ok: false, error: "Confirme que as notas serão lançadas posteriormente antes de rematricular.", code: "REMATRICULA_DECISION_REQUIRED" }, { status: 409 });
      }

      if (numeroOrigem !== null && numeroDestino !== null) {
        if (numeroOrigem === 12 && !reprovado) {
          return NextResponse.json({ ok: false, error: "A 12ª classe não tem uma classe seguinte configurada.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
        }
        const esperado = reprovado ? numeroOrigem : numeroOrigem + 1;
        if (numeroDestino !== esperado) {
          return NextResponse.json({ ok: false, error: reprovado ? "O aluno deve permanecer na classe em que reprovou." : "A turma destino deve ser a classe imediatamente seguinte.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
        }
      }
      if (turmaOrigem?.curso_id && turmaDestino?.curso_id && turmaOrigem.curso_id !== turmaDestino.curso_id) {
        return NextResponse.json({ ok: false, error: "A turma destino pertence a outro curso.", code: "REMATRICULA_PROGRESSION_INVALID" }, { status: 409 });
      }
    }

    const { data: service, error: serviceError } = await (supabase as any)
      .from("servicos_escola")
      .select("id, codigo, nome, valor_base, ativo")
      .eq("escola_id", escolaId)
      .eq("codigo", SERVICE_CODE)
      .maybeSingle();
    if (serviceError) throw serviceError;
    const targetPricing = await resolveValorConfirmacao(supabase, {
      escolaId,
      anoLetivo: normalizeAnoLetivo(academicContext.anoLetivoLabel),
      cursoId: turmaDestino?.curso_id,
      classeId: turmaDestino?.classe_id,
      valorGlobal: service?.valor_base,
    });
    const valorConfirmacao = targetPricing.valor;
    const confirmationExempt = Boolean(service?.ativo && targetPricing.origem === "classe" && valorConfirmacao === 0);
    if (!service || !service.ativo || (valorConfirmacao <= 0 && !confirmationExempt)) {
      return NextResponse.json({ ok: false, error: "O emolumento de rematrícula ainda não está configurado.", code: "REMATRICULA_PRICE_NOT_CONFIGURED" }, { status: 409 });
    }

    const { data: pedidosExistentes } = await (supabase as any)
      .from("servico_pedidos")
      .select("id, status, contexto")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("servico_codigo", SERVICE_CODE)
      .in("status", ["pending_payment", "granted"])
      .order("created_at", { ascending: false });
    const pedidoExistente = (pedidosExistentes ?? []).find(
      (pedido: any) => pedido.contexto?.ano_letivo_id === academicContext.anoLetivoId,
    ) ?? (pedidosExistentes ?? []).find(
      (pedido: any) => !pedido.contexto || Object.keys(pedido.contexto).length === 0,
    );
    const pedidoLegado = Boolean(
      pedidoExistente && (!pedidoExistente.contexto || Object.keys(pedidoExistente.contexto).length === 0),
    );
    if (pedidoLegado) {
      return NextResponse.json({ ok: false, error: "Existe um pedido antigo sem ano letivo identificado. Envie para reconciliação antes de criar uma nova taxa.", code: "REMATRICULA_LEGACY_REVIEW_REQUIRED", pedido_id: pedidoExistente.id }, { status: 409 });
    }
    if (pedidoExistente?.status === "granted") {
      const matriculaDestinoId = (pedidoExistente.contexto as any)?.matricula_destino_id;
      if (!matriculaDestinoId) {
        // The payment may have granted the service before the academic
        // matrícula was finalized. Never issue a second charge or fabricate
        // a destination from the origin matrícula; reconcile the paid order.
        return NextResponse.json({
          ok: false,
          error: "Pagamento já recebido; a matrícula será concluída sem nova cobrança.",
          code: "REMATRICULA_RECONCILIATION_REQUIRED",
          pedido_id: pedidoExistente.id,
        }, { status: 409 });
      }
      const comprovante = await emitirComprovanteMatricula({
        supabase,
        escolaId,
        matriculaId: matriculaDestinoId,
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: { portal: "secretaria", acao: "REMATRICULA_COMPROVANTE_REUTILIZADO" },
      });
      return NextResponse.json({ ok: true, pedido_id: pedidoExistente.id, rematricula: { matricula_id: matriculaDestinoId, ano_letivo_id: academicContext.anoLetivoId }, comprovante });
    }
    if (pedidoExistente?.status === "pending_payment") {
      if (pedidoLegado) {
        return NextResponse.json({ ok: false, error: "Existe um pedido antigo sem ano letivo identificado. Envie para reconciliação antes de criar uma nova taxa.", code: "REMATRICULA_LEGACY_REVIEW_REQUIRED", pedido_id: pedidoExistente.id }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: "Já existe uma rematrícula em pagamento para este aluno e ano.", code: "PAYMENT_IN_PROGRESS", pedido_id: pedidoExistente.id }, { status: 409 });
    }

    // Regra financeira obrigatória: nenhuma rematrícula nova/reconfirmação
    // pode avançar enquanto existir saldo pendente na matrícula de origem.
    // A taxa de rematrícula é um serviço separado e não liquida mensalidades.
    const { data: mensalidadesOrigem, error: mensalidadesError } = await supabase
      .from("mensalidades")
      .select("status, valor_previsto, valor, valor_pago_total, data_vencimento, mes_referencia, ano_referencia")
      .eq("escola_id", escolaId)
      .eq("aluno_id", body.aluno_id)
      .eq("matricula_id", origemMatriculaId);
    if (mensalidadesError) throw mensalidadesError;

    const today = todayInLuanda();
    const mensalidadesPendentes = (mensalidadesOrigem ?? []).filter((mensalidade: any) => {
      const status = String(mensalidade.status ?? "").toLowerCase();
      const saldo = Math.max(
        Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0) - Number(mensalidade.valor_pago_total ?? 0),
        0,
      );
      return saldo > 0 && !["pago", "isento", "cancelado"].includes(status) && isMensalidadeVencida(mensalidade, today);
    });
    if (mensalidadesPendentes.length > 0) {
      const total = mensalidadesPendentes.reduce((sum, mensalidade: any) => sum + Math.max(
        Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0) - Number(mensalidade.valor_pago_total ?? 0),
        0,
      ), 0);
      return NextResponse.json({
        ok: false,
        error: "Regularize as mensalidades do ano anterior antes de concluir a rematrícula.",
        code: "REMATRICULA_DEBT_REQUIRED",
        debt: { count: mensalidadesPendentes.length, total },
      }, { status: 409 });
    }

    if (matriculaDestino && !reclassificacao && matriculaDestino.turma_id !== body.destino_turma_id) {
      return NextResponse.json(
        { ok: false, error: "A reconfirmação deve manter a turma destino já preparada.", code: "RECONFIRMATION_TURMA_MISMATCH" },
        { status: 409 },
      );
    }

    const { data: pedido, error: pedidoError } = await (supabase as any)
      .from("servico_pedidos")
      .insert({
        escola_id: escolaId,
        aluno_id: body.aluno_id,
        matricula_id: origemMatriculaId,
        servico_escola_id: service.id,
        status: confirmationExempt ? "granted" : "pending_payment",
        servico_codigo: SERVICE_CODE,
        servico_nome: service.nome,
        valor_cobrado: valorConfirmacao,
        contexto: {
          origem: "rematricula_balcao",
          origem_matricula_id: origemMatriculaId,
          ano_letivo_id: academicContext.anoLetivoId,
          destino_turma_id: body.destino_turma_id,
          destino_curso_id: turmaDestino?.curso_id ?? null,
          destino_classe_id: turmaDestino?.classe_id ?? null,
          valor_origem: targetPricing.origem,
          notas_lancar_depois: body.notas_lancar_depois === true,
          idempotency_key: idempotencyKey,
        },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pedidoError) throw pedidoError;

    let paymentJson: any = { data: null };
    if (!confirmationExempt) {
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
        valor: valorConfirmacao,
        metodo: body.metodo,
        reference: body.reference ?? null,
        evidence_url: body.evidence_url ?? null,
        gateway_ref: body.gateway_ref ?? null,
        meta: {
          origem: "rematricula_balcao",
          tipo_comprovativo: "confirmacao",
          servico_codigo: SERVICE_CODE,
          descricao_item: service.nome,
          itens_pagamento: [{ codigo: SERVICE_CODE, descricao: service.nome, valor: valorConfirmacao }],
          pedido_id: pedido.id,
          rematricula_ano_letivo_id: academicContext.anoLetivoId,
        },
      }),
      });
      paymentJson = await paymentResponse.json().catch(() => null);
      if (!paymentResponse.ok || !paymentJson?.ok) {
        await (supabase as any).from("servico_pedidos").update({ status: "canceled", reason_code: "PAYMENT_FAILED", reason_detail: paymentJson?.error || "Falha no pagamento" }).eq("id", pedido.id).eq("escola_id", escolaId);
        return NextResponse.json({ ok: false, error: paymentJson?.error || "Falha ao registar o pagamento.", code: "PAYMENT_REQUIRED" }, { status: 400 });
      }
    }

    const { data: raaAtual } = await (supabase as any).rpc("resolve_raa_progression_for_matricula", {
      p_escola_id: escolaId,
      p_matricula_id: origemMatriculaId,
    });
    let rematriculaCondicionalConcluida = false;

    // A virada histórica deixou algumas matrículas destino ativas antes de
    // existir a autorização académica. Mantemos a vaga, mas só concluímos a
    // rematrícula mediante autorização explícita para lançar notas depois.
    if (matriculaDestino && !reclassificacao && raaAtual?.decision === "pendente") {
      if (body.notas_lancar_depois !== true) {
        await (supabase as any).from("servico_pedidos").update({
          status: "pending_payment",
          reason_code: "PROMOTION_AUTHORIZATION_REQUIRED",
          reason_detail: "A promoção académica ainda tem notas pendentes.",
        }).eq("id", pedido.id).eq("escola_id", escolaId);
        return NextResponse.json({
          ok: false,
          error: "A promoção tem notas pendentes. Confirme o lançamento posterior das notas para concluir.",
          code: "PROMOTION_AUTHORIZATION_REQUIRED",
          payment: paymentJson.data ?? null,
          pedido_id: pedido.id,
        }, { status: 409 });
      }

      const { error: authorizationError } = await (supabase as any).rpc("autorizar_promocao_com_pendencias", {
        p_escola_id: escolaId,
        p_aluno_id: body.aluno_id,
        p_matricula_origem_id: origemMatriculaId,
        p_destino_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: body.destino_turma_id,
        p_motivo: "Promoção autorizada no Balcão; notas serão lançadas posteriormente",
      });
      if (authorizationError) {
        await (supabase as any).from("servico_pedidos").update({
          status: "pending_payment",
          reason_code: "PROMOTION_AUTHORIZATION_REQUIRED",
          reason_detail: authorizationError.message,
        }).eq("id", pedido.id).eq("escola_id", escolaId);
        return NextResponse.json({
          ok: false,
          error: "Pagamento confirmado, mas a promoção com pendências precisa de autorização.",
          code: "PROMOTION_AUTHORIZATION_REQUIRED",
          details: authorizationError.message,
          payment: paymentJson.data ?? null,
          pedido_id: pedido.id,
        }, { status: 409 });
      }

      const destinoId = String(matriculaDestino.id);
      await (supabase as any).from("servico_pedidos").update({
        status: "granted",
        matricula_id: destinoId,
        contexto: {
          ...(pedido.contexto ?? {}),
          matricula_destino_id: destinoId,
          promocao_com_pendencias: true,
          decisao: "promovido_com_pendencias",
        },
      }).eq("id", pedido.id).eq("escola_id", escolaId);
      await (supabase as any).from("promocoes_com_pendencias").update({
        matricula_destino_id: matriculaDestinoId,
        status: "concluida",
        concluido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("escola_id", escolaId)
        .eq("matricula_origem_id", origemMatriculaId)
        .eq("destino_ano_letivo_id", academicContext.anoLetivoId)
        .eq("status", "autorizada");
      matriculaDestinoId = destinoId;
      rematriculaCondicionalConcluida = true;
    }

    if (body.notas_lancar_depois === true && !matriculaDestino) {
      const { error: authorizationError } = await (supabase as any).rpc("autorizar_promocao_com_pendencias", {
        p_escola_id: escolaId,
        p_aluno_id: body.aluno_id,
        p_matricula_origem_id: origemMatriculaId,
        p_destino_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: body.destino_turma_id,
        p_motivo: "Promoção autorizada no Balcão; notas serão lançadas posteriormente",
      });
      if (authorizationError) {
        await (supabase as any).from("servico_pedidos").update({
          status: "pending_payment",
          reason_code: "PROMOTION_AUTHORIZATION_REQUIRED",
          reason_detail: authorizationError.message,
        }).eq("id", pedido.id).eq("escola_id", escolaId);
        return NextResponse.json({
          ok: false,
          error: "Pagamento confirmado, mas a promoção com pendências precisa de autorização.",
          code: "PROMOTION_AUTHORIZATION_REQUIRED",
          details: authorizationError.message,
          payment: paymentJson.data ?? null,
          pedido_id: pedido.id,
        }, { status: 409 });
      }
    }

    let matriculaDestinoId = "";
    let finalizacao: any;
    let finalizacaoError: any = null;

    if (rematriculaCondicionalConcluida) {
      finalizacao = { ok: true, matricula_id: matriculaDestinoId };
    } else if (matriculaDestino && reclassificacao) {
      const result = await (supabase as any).rpc("finalistas_matricular_novo_ciclo", {
        p_escola_id: escolaId,
        p_reclassificacao_ids: [reclassificacao.id],
        p_turma_destino_id: body.destino_turma_id,
        p_motivo: "Continuidade confirmada e taxa de reconfirmação paga no Balcão",
      });
      finalizacao = result.data;
      finalizacaoError = result.error;
      if (finalizacao?.ok) {
        matriculaDestinoId = String(matriculaDestino.id);
        await (supabase as any)
          .from("servico_pedidos")
          .update({
            status: "granted",
            matricula_id: matriculaDestinoId,
            contexto: {
              ...(pedido.contexto ?? {}),
              matricula_destino_id: matriculaDestinoId,
              destino_turma_id: body.destino_turma_id,
              finalista: true,
              decisao: "matriculado_novo_ciclo",
            },
          })
          .eq("id", pedido.id)
          .eq("escola_id", escolaId);
      }
    } else if (matriculaDestino) {
      // A promoção cria apenas uma reserva pendente. A mesma transação que
      // confirma a taxa deve ativar a matrícula e iniciar o seu ciclo financeiro.
      const result = await (supabase as any).rpc("finalizar_rematricula_balcao", {
        p_escola_id: escolaId,
        p_aluno_id: body.aluno_id,
        p_matricula_origem_id: origemMatriculaId,
        p_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: body.destino_turma_id,
        p_pedido_id: pedido.id,
      });
      finalizacao = result.data;
      finalizacaoError = result.error;
      matriculaDestinoId = String(finalizacao?.matricula_id ?? matriculaDestino.id);
    } else {
      const result = await (supabase as any).rpc("finalizar_rematricula_balcao", {
        p_escola_id: escolaId,
        p_aluno_id: body.aluno_id,
        p_matricula_origem_id: origemMatriculaId,
        p_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: body.destino_turma_id,
        p_pedido_id: pedido.id,
      });
      finalizacao = result.data;
      finalizacaoError = result.error;
      matriculaDestinoId = String(finalizacao?.matricula_id ?? "");
    }
    if (finalizacaoError || !finalizacao?.ok) {
      const reason = finalizacaoError?.message || finalizacao?.erro || "Falha ao concluir a matrícula destino";
      await (supabase as any).from("servico_pedidos").update({ status: "pending_payment", reason_code: "REMATRICULA_RECONCILIATION_REQUIRED", reason_detail: reason }).eq("id", pedido.id).eq("escola_id", escolaId);
      return NextResponse.json({
        ok: false,
        error: "Pagamento confirmado, mas a matrícula precisa de reconciliação.",
        code: "REMATRICULA_RECONCILIATION_REQUIRED",
        reconciliation_reason: reason,
        payment: paymentJson.data ?? null,
        pedido_id: pedido.id,
      }, { status: 409 });
    }
    matriculaDestinoId = String(finalizacao.matricula_id ?? matriculaDestinoId);

    const comprovante = await emitirComprovanteMatricula({
      supabase,
      escolaId,
      matriculaId: matriculaDestinoId,
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
      entityId: matriculaDestinoId,
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
      rematricula: { matricula_id: matriculaDestinoId, ano_letivo_id: academicContext.anoLetivoId, turma_id: body.destino_turma_id },
      pagamento: paymentJson.data ?? null,
      comprovante,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) return errorResponse(error);
    const message = errorMessage(error);
    console.error("[REMATRICULA-BALCAO]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
