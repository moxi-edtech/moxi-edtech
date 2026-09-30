import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveOpenRematriculaWindow } from "@/lib/secretaria/rematricula-window";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveRematriculaSource } from "@/lib/alunoRematriculaSource";
import { resolveRaaProgressionForMatricula, RaaProgressionUnavailableError } from "@/lib/academico/raa-progression-server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.alunoId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, ctx.userId, ctx.escolaId);
    if (!escolaId || escolaId !== ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Sem acesso à escola do aluno." }, { status: 403 });
    }

    const activeAno = await resolveAnoLetivoScope(supabase, escolaId);
    if (!activeAno) {
      return NextResponse.json({ ok: false, error: "A escola ainda não configurou um ano letivo ativo.", code: "ACTIVE_ACADEMIC_YEAR_UNAVAILABLE" }, { status: 409 });
    }

    const openWindow = await resolveOpenRematriculaWindow(supabase, escolaId, activeAno.ano);
    if (!openWindow) {
      return NextResponse.json({ ok: false, error: "A janela de rematrícula ainda não está aberta.", code: "REMATRICULA_WINDOW_CLOSED" }, { status: 409 });
    }

    // A origem pode ser uma matrícula histórica encerrada; a matrícula destino
    // só deve ficar oficial depois da confirmação financeira.
    const { data: matricula, error: matriculaError } = await resolveRematriculaSource(
      supabase,
      escolaId,
      ctx.alunoId,
      openWindow.ano_letivo,
    );
    if (matriculaError || !matricula?.id) {
      return NextResponse.json({ ok: false, error: "Não foi encontrada uma matrícula de origem para iniciar a rematrícula. Contacte a secretaria.", code: "REMATRICULA_SOURCE_INVALID" }, { status: 409 });
    }

    if (!matricula.turma_id) {
      return NextResponse.json({ ok: false, error: "A matrícula de origem não tem turma académica associada.", code: "ACADEMIC_PROMOTION_PENDING" }, { status: 409 });
    }

    try {
      const academic = await resolveRaaProgressionForMatricula(supabase, escolaId, {
        id: matricula.id,
        aluno_id: matricula.aluno_id,
        turma_id: matricula.turma_id,
      });
      const decision = academic.progression.decision;
      const conditionalEnrollmentBlocked = decision === "inscricao_condicional"
        && academic.progression.destino !== "proxima_etapa";
      if (decision === "pendente" || decision === "recurso" || conditionalEnrollmentBlocked) {
        return NextResponse.json({
          ok: false,
          error: conditionalEnrollmentBlocked
            ? "A inscrição condicional ainda não autoriza a matrícula na classe seguinte."
            : decision === "recurso"
            ? "Existem disciplinas em recurso antes da rematrícula."
            : "A situação académica ainda não está fechada.",
          code: "ACADEMIC_PROMOTION_PENDING",
          academic: {
            decision,
            disciplinaIdsPendentes: academic.progression.disciplinaIdsPendentes,
          },
        }, { status: 409 });
      }
      if (decision === "concluiu") {
        return NextResponse.json({ ok: false, error: "O ciclo académico foi concluído e não possui classe seguinte.", code: "ACADEMIC_CYCLE_COMPLETED" }, { status: 409 });
      }
    } catch (error) {
      if (error instanceof RaaProgressionUnavailableError) {
        return NextResponse.json({ ok: false, error: error.message, code: "ACADEMIC_PROMOTION_PENDING" }, { status: 409 });
      }
      throw error;
    }

    const body = await request.json().catch(() => ({}));
    const servicosIds = Array.isArray(body?.servicos_ids)
      ? body.servicos_ids.filter((value: unknown): value is string => typeof value === "string")
      : [];

    const { data, error } = await (supabase as any).rpc("aluno_iniciar_rematricula", {
      p_matricula_id: matricula.id,
      p_servicos_ids: servicosIds,
    });

    if (error) {
      const message = error.message || "Não foi possível iniciar a rematrícula.";
      const status = message.includes("FINANCEIRO:") || message.includes("AUTH:") ? 403 : 409;
      return NextResponse.json({ ok: false, error: message.replace(/^(DATA|FINANCEIRO|AUTH|ACADEMICO):\s*/, "") }, { status });
    }

    return NextResponse.json(data ?? { ok: false, error: "Resposta inválida ao iniciar rematrícula." });
  } catch (error) {
    console.error("[aluno/rematricula/iniciar]", error);
    return NextResponse.json({ ok: false, error: "Não foi possível iniciar a rematrícula." }, { status: 500 });
  }
}
