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

const Body = z.object({
  pedido_id: z.string().uuid(),
  action: z.enum(["associate", "cancel", "complete"]).default("associate"),
  ano_letivo_id: z.string().uuid().optional(),
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
    if (pedido.status !== "pending_payment") {
      return NextResponse.json({ ok: false, error: "Este pedido já não está pendente", code: "PEDIDO_NOT_PENDING" }, { status: 409 });
    }

    if (parsed.data.action === "complete") {
      if (pedido.contexto?.origem !== "rematricula_balcao" || pedido.contexto?.ano_letivo_id == null) {
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
        .in("status", ["settled", "confirmed", "paid", "succeeded"]);
      const pagamentoConfirmado = (pagamentos ?? []).find(
        (pagamento: any) => pagamento.meta?.pedido_id === pedido.id,
      );
      if (!pagamentoConfirmado) {
        return NextResponse.json({ ok: false, error: "Não foi encontrado um pagamento liquidado para este pedido", code: "PAYMENT_NOT_SETTLED" }, { status: 409 });
      }

      const academicContext = await resolveAcademicYearContext(supabase, {
        userId: user.id,
        requestedAcademicYearId: String(pedido.contexto.ano_letivo_id),
        operation: "WRITE",
      });
      const destinoTurmaId = String(pedido.contexto.destino_turma_id ?? "");
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

      const { data: raa } = await supabase.rpc("resolve_raa_progression_for_matricula", {
        p_escola_id: escolaId,
        p_matricula_id: matriculaOrigemId,
      });
      if (raa?.decision === "pendente") {
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
          pagamento_id: pagamentoConfirmado.id,
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
