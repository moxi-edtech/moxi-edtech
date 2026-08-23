import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";
import { emitirComprovanteMatricula } from "@/lib/documentos/emitirComprovanteMatricula";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function classeNumero(classe: any): number | null {
  const numero = Number(classe?.numero);
  if (Number.isFinite(numero) && numero >= 0) return numero;
  const nome = String(classe?.nome ?? "");
  if (/pré[\s-]*escolar/i.test(nome)) return 0;
  const match = nome.match(/(\d{1,2})\s*(?:ª|a)?/i);
  return match ? Number(match[1]) : null;
}

const Body = z.object({
  pedido_id: z.string().uuid(),
  action: z.enum(["associate", "cancel", "complete"]).default("associate"),
  ano_letivo_id: z.string().uuid().optional(),
  destino_turma_id: z.string().uuid().optional(),
  decisao_resultado: z.enum(["aprovado", "reprovado", "concluido"]).optional(),
  decisao_fonte: z.string().trim().min(1).max(80).optional(),
  decisao_motivo: z.string().trim().min(1).max(500).optional(),
  decisao_observacao: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "secretaria_financeiro", "financeiro", "admin_financeiro", "admin", "admin_escola", "staff_admin"],
    });
    if (authz.error) return authz.error;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Pedido inválido" }, { status: 400 });

    const { data: pedido } = await supabase
      .from("servico_pedidos")
      .select("id, status, servico_codigo, contexto, aluno_id, matricula_id")
      .eq("id", parsed.data.pedido_id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!pedido || pedido.servico_codigo !== "SERV_REMATRICULA") {
      return NextResponse.json({ ok: false, error: "Pedido de rematrícula não encontrado" }, { status: 404 });
    }
    // The payment endpoint may already move the service pedido to `granted`
    // before the academic transaction finishes. Reconciliation must be safe
    // to retry in that state instead of returning a misleading 409.
    if (!(["pending_payment", "granted"] as string[]).includes(String(pedido.status))) {
      return NextResponse.json({ ok: false, error: "Este pedido já não está pendente", code: "PEDIDO_NOT_PENDING" }, { status: 409 });
    }

    if (parsed.data.action === "cancel") {
      if (pedido.status !== "pending_payment") {
        return NextResponse.json({ ok: false, error: "Só é possível cancelar um pedido pendente", code: "PEDIDO_NOT_PENDING" }, { status: 409 });
      }
      const { data: intents } = await supabase
        .from("pagamento_intents")
        .select("id, status, reference, evidence_url")
        .eq("escola_id", escolaId)
        .eq("servico_pedido_id", pedido.id)
        .limit(1);
      const { data: pagamentos } = pedido.aluno_id
        ? await supabase
            .from("pagamentos")
            .select("id, status, meta")
            .eq("escola_id", escolaId)
            .eq("aluno_id", pedido.aluno_id)
            .limit(50)
        : { data: [] };
      const pagamentosAssociados = (pagamentos ?? []).filter((pagamento: any) =>
        pagamento.meta?.pedido_id === pedido.id ||
        pagamento.meta?.servico_pedido_id === pedido.id,
      );
      const pagamentoLiquidado = pagamentosAssociados.some((pagamento: any) =>
        ["settled", "confirmed", "paid", "succeeded", "confirmado", "recebido", "pago"].includes(String(pagamento.status).toLowerCase()),
      );
      const intentsReiniciaveis = (intents ?? []).length > 0 && (intents ?? []).every((intent: any) =>
        String(intent.status).toLowerCase() === "draft" &&
        !String(intent.reference ?? "").trim() &&
        !String(intent.evidence_url ?? "").trim(),
      );
      const pagamentoAssociadoNaoReiniciavel = pagamentoLiquidado ||
        (pagamentosAssociados.length > 0 && !pagamentoLiquidado) ||
        ((intents ?? []).length > 0 && !intentsReiniciaveis);
      if (pagamentoAssociadoNaoReiniciavel) {
        return NextResponse.json({ ok: false, error: "Existe pagamento ou comprovativo associado; encaminhe para reconciliação financeira", code: "PAYMENT_ASSOCIATED" }, { status: 409 });
      }
      const { data, error } = await supabase.rpc("balcao_cancelar_pedido", {
        p_pedido_id: pedido.id,
        p_reason: intentsReiniciaveis
          ? "Tentativa de pagamento sem liquidação cancelada no Balcão para reiniciar a cobrança"
          : "Pedido pendente sem pagamento cancelado no Balcão para reiniciar a rematrícula correta",
      });
      if (error) throw error;
      recordAuditServer({
        escolaId,
        portal: "secretaria",
        acao: "REMATRICULA_BALCAO_PEDIDO_PENDENTE_CANCELADO",
        entity: "servico_pedidos",
        entityId: pedido.id,
        details: { aluno_id: pedido.aluno_id, motivo: intentsReiniciaveis ? "tentativa_sem_liquidacao" : "sem_pagamento_associado" },
      });
      return NextResponse.json({ ok: true, pedido_id: pedido.id, result: data, action: "cancel" });
    }

    if (parsed.data.action === "complete") {
      const portalPedido = pedido.contexto?.origem === "portal_rematricula";
      const hasAcademicContext = pedido.contexto?.ano_letivo_id != null || portalPedido;
      if (!hasAcademicContext) {
        return NextResponse.json({ ok: false, error: "Este pedido não tem contexto suficiente para reconciliação", code: "PEDIDO_CONTEXT_INVALID" }, { status: 409 });
      }
      if (!pedido.aluno_id) {
        return NextResponse.json({ ok: false, error: "Aluno do pedido não encontrado", code: "PEDIDO_STUDENT_NOT_FOUND" }, { status: 404 });
      }

      const { data: pagamentos } = await supabase
        .from("pagamentos")
        .select("id, status, valor_pago, meta")
        .eq("escola_id", escolaId)
        .eq("aluno_id", pedido.aluno_id)
        .in("status", ["settled", "confirmed", "paid", "succeeded", "confirmado", "recebido", "pago"]);
      const pagamentoConfirmado = (pagamentos ?? []).find(
        (pagamento: any) => pagamento.meta?.pedido_id === pedido.id || pagamento.meta?.servico_pedido_id === pedido.id,
      );
      const { data: intents } = await supabase
        .from("pagamento_intents")
        .select("id, status, servico_pedido_id")
        .eq("escola_id", escolaId)
        .eq("servico_pedido_id", pedido.id);
      const intentConfirmado = (intents ?? []).find((intent: any) =>
        ["settled", "confirmed", "paid", "succeeded", "confirmado", "recebido", "pago"].includes(String(intent.status).toLowerCase()),
      );
      if (!pagamentoConfirmado && !intentConfirmado) {
        return NextResponse.json({ ok: false, error: "Não foi encontrado um pagamento liquidado para este pedido", code: "PAYMENT_NOT_SETTLED" }, { status: 409 });
      }

      const academicContext = await resolveAcademicYearContext(supabase, {
        userId: user.id,
        requestedAcademicYearId: parsed.data.ano_letivo_id ?? String(pedido.contexto.ano_letivo_id),
        operation: "WRITE",
      });
      const destinoTurmaId = String(parsed.data.destino_turma_id ?? pedido.contexto.destino_turma_id ?? "");
      if (!destinoTurmaId) {
        return NextResponse.json({ ok: false, error: "Turma destino não encontrada no pedido", code: "DESTINATION_CLASS_REQUIRED" }, { status: 409 });
      }

      const { data: turmaDestino } = await supabase
        .from("turmas")
        .select("id, session_id, ano_letivo")
        .eq("escola_id", escolaId)
        .eq("id", destinoTurmaId)
        .maybeSingle();
      const { data: matriculaPedido } = await supabase
        .from("matriculas")
        .select("id, ano_letivo, status, turma_id")
        .eq("escola_id", escolaId)
        .eq("id", pedido.matricula_id)
        .eq("aluno_id", pedido.aluno_id)
        .maybeSingle();

      // Pedidos antigos podem ter guardado a matrícula já criada no ano
      // destino. Recuperamos a matrícula do ano anterior antes de reconciliar.
      let matriculaOrigemId = String(pedido.matricula_id ?? "");
      if (turmaDestino?.ano_letivo && matriculaPedido?.ano_letivo >= turmaDestino.ano_letivo) {
        const { data: matriculaAnterior } = await supabase
          .from("matriculas")
          .select("id, ano_letivo, status, turma_id")
          .eq("escola_id", escolaId)
          .eq("aluno_id", pedido.aluno_id)
          .lt("ano_letivo", turmaDestino.ano_letivo)
          .order("ano_letivo", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (matriculaAnterior) matriculaOrigemId = String(matriculaAnterior.id);
      }

      const decisaoAdministrativa = parsed.data.decisao_fonte === "declaracao_administrativa_escola";
      if (decisaoAdministrativa) {
        if (!parsed.data.decisao_motivo?.trim() || !parsed.data.decisao_resultado) {
          return NextResponse.json({ ok: false, error: "Resultado e motivo são obrigatórios para a decisão administrativa.", code: "DECISAO_MOTIVO_REQUIRED" }, { status: 400 });
        }
        const { data: origem } = await supabase
          .from("matriculas")
          .select("id, ano_letivo")
          .eq("escola_id", escolaId)
          .eq("id", matriculaOrigemId)
          .eq("aluno_id", pedido.aluno_id)
          .maybeSingle();
        const { data: cohortMember, error: cohortError } = await (supabase as any)
          .from("academic_transition_cohort_members")
          .select("id, cohort:academic_transition_cohorts!inner(ativo, ano_origem, ano_destino, expira_em)")
          .eq("escola_id", escolaId)
          .eq("matricula_origem_id", matriculaOrigemId)
          .eq("status", "elegivel")
          .maybeSingle();
        if (cohortError) throw cohortError;
        const cohort = Array.isArray(cohortMember?.cohort) ? cohortMember.cohort[0] : cohortMember?.cohort;
        const cohortAtivo = cohort?.ativo === true
          && Number(cohort?.ano_origem) === Number(origem?.ano_letivo)
          && Number(cohort?.ano_destino) === Number(academicContext.anoLetivoLabel.slice(0, 4))
          && (!cohort?.expira_em || new Date(`${cohort.expira_em}T23:59:59`).getTime() >= Date.now());
        if (!cohortAtivo) {
          return NextResponse.json({ ok: false, error: "Esta decisão sem notas exige uma coorte assistida válida.", code: "ASSISTED_TRANSITION_COHORT_REQUIRED" }, { status: 403 });
        }
      }

      // A virada/promocao pode já ter criado e ativado a matrícula destino
      // antes do pagamento ser reconciliado. Nesse caso, não devemos tentar
      // promover o aluno novamente: vinculamos o pagamento à matrícula
      // existente no ano destino.
      const destinoAno = Number(turmaDestino?.ano_letivo ?? academicContext.anoLetivoLabel.slice(0, 4));
      const { data: matriculaDestinoExistente } = await supabase
        .from("matriculas")
        .select("id, turma_id, ano_letivo, status")
        .eq("escola_id", escolaId)
        .eq("aluno_id", pedido.aluno_id)
        .eq("ano_letivo", destinoAno)
        .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
        .limit(1)
        .maybeSingle();
      if (matriculaDestinoExistente && String(matriculaDestinoExistente.id) !== matriculaOrigemId) {
        if (decisaoAdministrativa) {
          if (parsed.data.decisao_resultado === "concluido") {
            return NextResponse.json({ ok: false, error: "Há uma matrícula destino preparada. Reveja-a antes de concluir o ciclo do aluno.", code: "CONCLUSION_DESTINATION_REVIEW_REQUIRED" }, { status: 409 });
          }
          if (String(matriculaDestinoExistente.turma_id ?? "") !== destinoTurmaId) {
            return NextResponse.json({ ok: false, error: "A turma escolhida não corresponde à matrícula destino já preparada. Escolha a decisão que corresponde à turma existente ou reveja o destino.", code: "RECONCILIATION_DESTINATION_MISMATCH" }, { status: 409 });
          }
          const [{ data: origemComTurma }, { data: destinoComTurma }] = await Promise.all([
            supabase.from("matriculas").select("turma_id, turmas:turma_id(classe_id)").eq("escola_id", escolaId).eq("id", matriculaOrigemId).maybeSingle(),
            supabase.from("turmas").select("classe_id").eq("escola_id", escolaId).eq("id", destinoTurmaId).maybeSingle(),
          ]);
          const origemTurma = Array.isArray((origemComTurma as any)?.turmas) ? (origemComTurma as any).turmas[0] : (origemComTurma as any)?.turmas;
          const classeIds = [origemTurma?.classe_id, destinoComTurma?.classe_id].filter(Boolean);
          const { data: classes } = classeIds.length
            ? await supabase.from("classes").select("id, nome, numero").eq("escola_id", escolaId).in("id", classeIds)
            : { data: [] };
          const classeById = new Map((classes ?? []).map((classe: any) => [classe.id, classe]));
          const origemNumero = classeNumero(classeById.get(origemTurma?.classe_id));
          const destinoNumero = classeNumero(classeById.get(destinoComTurma?.classe_id));
          const esperado = parsed.data.decisao_resultado === "reprovado" ? origemNumero : (origemNumero == null ? null : origemNumero + 1);
          if (esperado == null || destinoNumero !== esperado) {
            return NextResponse.json({ ok: false, error: parsed.data.decisao_resultado === "reprovado" ? "A reprovação exige a mesma classe no destino preparado." : "A aprovação exige a classe imediatamente seguinte no destino preparado.", code: "RECONCILIATION_PROGRESSION_INVALID" }, { status: 409 });
          }
          const { error: academicError } = await (supabase as any).rpc("finalizar_origem_academica", {
            p_escola_id: escolaId,
            p_matricula_id: matriculaOrigemId,
            p_resultado_final: parsed.data.decisao_resultado,
            p_fonte: parsed.data.decisao_fonte,
            p_motivo: parsed.data.decisao_motivo,
            p_observacao: parsed.data.decisao_observacao ?? null,
          });
          if (academicError) {
            return NextResponse.json({ ok: false, error: "Não foi possível registar a decisão académica.", code: "ACADEMIC_RESULT_RECONCILIATION_REQUIRED" }, { status: 409 });
          }
        }
        await supabase.from("servico_pedidos").update({
          status: "granted",
          matricula_id: matriculaDestinoExistente.id,
          contexto: {
            ...(pedido.contexto ?? {}),
            origem_matricula_id: matriculaOrigemId,
            matricula_destino_id: matriculaDestinoExistente.id,
            destino_turma_id: matriculaDestinoExistente.turma_id ?? destinoTurmaId,
            reconciliado_com_matricula_existente: true,
          },
        }).eq("id", pedido.id).eq("escola_id", escolaId);

        const comprovante = await emitirComprovanteMatricula({
          supabase,
          escolaId,
          matriculaId: matriculaDestinoExistente.id,
          dataHoraEfetivacao: new Date().toISOString(),
          createdBy: user.id,
          audit: { portal: "secretaria", acao: "REMATRICULA_RECONCILIADA_MATRICULA_EXISTENTE" },
        });
        recordAuditServer({
          escolaId,
          portal: "secretaria",
          acao: "REMATRICULA_BALCAO_RECONCILIADA_MATRICULA_EXISTENTE",
          entity: "servico_pedidos",
          entityId: pedido.id,
          details: { aluno_id: pedido.aluno_id, matricula_id: matriculaDestinoExistente.id, pagamento_id: pagamentoConfirmado?.id ?? intentConfirmado?.id ?? null },
        });
        if (!comprovante.ok) {
          return NextResponse.json({ ok: false, error: "Rematrícula reconciliada, mas o comprovante precisa de emissão.", code: "DOCUMENT_PENDING", pedido_id: pedido.id, rematricula: { matricula_id: matriculaDestinoExistente.id }, comprovante }, { status: 202 });
        }
        return NextResponse.json({ ok: true, pedido_id: pedido.id, rematricula: { matricula_id: matriculaDestinoExistente.id, turma_id: matriculaDestinoExistente.turma_id, ano_letivo_id: academicContext.anoLetivoId }, comprovante });
      }

      if (decisaoAdministrativa) {
        const { error: academicError } = await (supabase as any).rpc("finalizar_origem_academica", {
          p_escola_id: escolaId,
          p_matricula_id: matriculaOrigemId,
          p_resultado_final: parsed.data.decisao_resultado,
          p_fonte: parsed.data.decisao_fonte,
          p_motivo: parsed.data.decisao_motivo,
          p_observacao: parsed.data.decisao_observacao ?? null,
        });
        if (academicError) {
          return NextResponse.json({ ok: false, error: "Não foi possível registar a decisão académica.", code: "ACADEMIC_RESULT_RECONCILIATION_REQUIRED" }, { status: 409 });
        }
      }

      const { data: raa } = await supabase.rpc("resolve_raa_progression_for_matricula", {
        p_escola_id: escolaId,
        p_matricula_id: matriculaOrigemId,
      });
      if (raa?.decision === "pendente" && !decisaoAdministrativa) {
        const { error: authorizationError } = await supabase.rpc("autorizar_promocao_com_pendencias", {
          p_escola_id: escolaId,
          p_aluno_id: pedido.aluno_id,
          p_matricula_origem_id: matriculaOrigemId,
          p_destino_ano_letivo_id: academicContext.anoLetivoId,
          p_destino_turma_id: destinoTurmaId,
          p_motivo: "Promoção autorizada durante a reconciliação; notas serão lançadas posteriormente",
        });
        if (authorizationError) {
          return NextResponse.json({ ok: false, error: authorizationError.message, code: "PROMOTION_AUTHORIZATION_FAILED" }, { status: 409 });
        }
      }

      // Remediação segura de pedidos criados depois de uma promoção
      // manual: a matrícula destino já existe e a origem foi encerrada.
      if (matriculaPedido?.ano_letivo >= Number(turmaDestino?.ano_letivo ?? 0)) {
        const { data: matriculaDestino } = await supabase
          .from("matriculas")
          .select("id, status, ano_letivo, turma_id")
          .eq("escola_id", escolaId)
          .eq("aluno_id", pedido.aluno_id)
          .eq("session_id", academicContext.anoLetivoId)
          .eq("turma_id", destinoTurmaId)
          .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
          .limit(1)
          .maybeSingle();
        if (matriculaDestino) {
          await supabase.from("servico_pedidos").update({
            status: "granted",
            matricula_id: matriculaDestino.id,
            contexto: {
              ...(pedido.contexto ?? {}),
              origem_matricula_id: matriculaOrigemId,
              matricula_destino_id: matriculaDestino.id,
              promocao_com_pendencias: raa?.decision === "pendente",
            },
          }).eq("id", pedido.id).eq("escola_id", escolaId);
          await supabase.from("promocoes_com_pendencias").update({
            matricula_destino_id: matriculaDestino.id,
            status: "concluida",
            concluido_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("escola_id", escolaId).eq("matricula_origem_id", matriculaOrigemId).eq("destino_ano_letivo_id", academicContext.anoLetivoId).eq("status", "autorizada");

          const comprovante = await emitirComprovanteMatricula({
            supabase,
            escolaId,
            matriculaId: matriculaDestino.id,
            dataHoraEfetivacao: new Date().toISOString(),
            createdBy: user.id,
            audit: { portal: "secretaria", acao: "REMATRICULA_RECONCILIADA_COMPROVANTE" },
          });
          if (!comprovante.ok) return NextResponse.json({ ok: false, error: "Rematrícula reconciliada, mas o comprovante precisa de emissão.", code: "DOCUMENT_PENDING", pedido_id: pedido.id, rematricula: { matricula_id: matriculaDestino.id }, comprovante }, { status: 202 });
          return NextResponse.json({ ok: true, pedido_id: pedido.id, rematricula: { matricula_id: matriculaDestino.id, turma_id: destinoTurmaId, ano_letivo_id: academicContext.anoLetivoId }, comprovante });
        }
      }

      const { data: finalizacao, error: finalizacaoError } = await supabase.rpc("finalizar_rematricula_balcao", {
        p_escola_id: escolaId,
        p_aluno_id: pedido.aluno_id,
        p_matricula_origem_id: matriculaOrigemId,
        p_ano_letivo_id: academicContext.anoLetivoId,
        p_destino_turma_id: destinoTurmaId,
        p_pedido_id: pedido.id,
      });
      if (finalizacaoError || !finalizacao?.ok) {
        return NextResponse.json({ ok: false, error: finalizacaoError?.message || finalizacao?.erro || "Não foi possível concluir a matrícula", code: "RECONCILIATION_FAILED" }, { status: 409 });
      }

      const comprovante = await emitirComprovanteMatricula({
        supabase,
        escolaId,
        matriculaId: String(finalizacao.matricula_id),
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: { portal: "secretaria", acao: "REMATRICULA_RECONCILIADA_COMPROVANTE" },
      });
      recordAuditServer({
        escolaId,
        portal: "secretaria",
        acao: "REMATRICULA_BALCAO_RECONCILIADA",
        entity: "servico_pedidos",
        entityId: pedido.id,
        details: {
          aluno_id: pedido.aluno_id,
          matricula_id: finalizacao.matricula_id,
          pagamento_id: pagamentoConfirmado?.id ?? intentConfirmado?.id ?? null,
          ano_letivo_id: academicContext.anoLetivoId,
        },
      });
      if (!comprovante.ok) {
        return NextResponse.json({ ok: false, error: "Rematrícula reconciliada, mas o comprovante precisa de emissão.", code: "DOCUMENT_PENDING", pedido_id: pedido.id, rematricula: finalizacao, comprovante }, { status: 202 });
      }
      return NextResponse.json({ ok: true, pedido_id: pedido.id, rematricula: finalizacao, comprovante });
    }
    if (pedido.contexto && Object.keys(pedido.contexto).length > 0) {
      return NextResponse.json({ ok: false, error: "Este pedido tem contexto e deve ser reconciliado pelo fluxo financeiro", code: "PEDIDO_CONTEXTUAL" }, { status: 409 });
    }

    let academicContext: Awaited<ReturnType<typeof resolveAcademicYearContext>> | null = null;
    let matriculaDestino: { id: string; turma_id: string | null; ano_letivo: number } | null = null;
    if (parsed.data.action === "associate") {
      if (!parsed.data.ano_letivo_id) {
        return NextResponse.json({ ok: false, error: "Ano letivo é obrigatório para associar o pedido", code: "ACADEMIC_YEAR_REQUIRED" }, { status: 400 });
      }
      academicContext = await resolveAcademicYearContext(supabase, {
        userId: user.id,
        requestedAcademicYearId: parsed.data.ano_letivo_id,
        operation: "WRITE",
      });
      const { data: alunoPedido } = await supabase
        .from("servico_pedidos")
        .select("aluno_id")
        .eq("id", pedido.id)
        .eq("escola_id", escolaId)
        .single();
      if (!alunoPedido?.aluno_id) {
        return NextResponse.json({ ok: false, error: "Aluno do pedido não encontrado", code: "PEDIDO_STUDENT_NOT_FOUND" }, { status: 404 });
      }
      const targetAno = Number(academicContext.anoLetivoLabel.slice(0, 4));
      const { data: target } = await supabase
        .from("matriculas")
        .select("id, turma_id, ano_letivo")
        .eq("escola_id", escolaId)
        .eq("aluno_id", alunoPedido.aluno_id)
        .eq("ano_letivo", targetAno)
        .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
        .limit(1)
        .maybeSingle();
      matriculaDestino = target;
    }

    const { data: intentes } = await supabase
      .from("pagamento_intents")
      .select("status")
      .eq("escola_id", escolaId)
      .eq("servico_pedido_id", pedido.id);
    const temPagamentoLiquidado = (intentes ?? []).some((intent: any) =>
      ["settled", "confirmed", "paid", "succeeded"].includes(String(intent.status).toLowerCase()),
    );
    if (temPagamentoLiquidado) {
      return NextResponse.json({ ok: false, error: "Existe pagamento liquidado; encaminhe para reconciliação financeira", code: "PAYMENT_SETTLED" }, { status: 409 });
    }

    if (parsed.data.action === "associate") {
      const { error: annotateError } = await supabase
        .from("servico_pedidos")
        .update({
          matricula_id: matriculaDestino?.id ?? null,
          reason_code: "LEGACY_ASSOCIATED_REPLACED",
          reason_detail: `Pedido associado ao ano ${academicContext?.anoLetivoLabel}; será substituído por uma operação com contexto completo`,
          contexto: {
            ...(pedido.contexto ?? {}),
            origem: "rematricula_balcao_legacy_reconciliada",
            ano_letivo_id: academicContext?.anoLetivoId,
            destino_turma_id: matriculaDestino?.turma_id ?? null,
            legacy_pedido_id: pedido.id,
          },
        })
        .eq("id", pedido.id)
        .eq("escola_id", escolaId);
      if (annotateError) throw annotateError;
    }

    const { data, error } = await supabase.rpc("balcao_cancelar_pedido", {
      p_pedido_id: pedido.id,
      p_reason: parsed.data.action === "associate"
        ? "Pedido antigo associado ao ano correto e substituído por operação contextual"
        : "Pedido incompleto cancelado pela secretaria",
    });
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      pedido_id: pedido.id,
      result: data,
      action: parsed.data.action,
      ano_letivo_id: academicContext?.anoLetivoId ?? null,
      matricula_destino_id: matriculaDestino?.id ?? null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
