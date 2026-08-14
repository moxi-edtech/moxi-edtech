import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET() {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!ctx.escolaId || !ctx.alunoId || !ctx.turmaId) {
    return noStore({ ok: true, items: [] });
  }

  const { data, error } = await (supabase as any)
    .from("atividades_pedagogicas")
    .select("id, titulo, instrucoes, tipo, turma_id, disciplina_id, aula_id, plano_aula_id, status, prazo, tentativas_permitidas, nota_maxima, published_at, created_at, atividade_questoes(id, ordem, tipo, enunciado, opcoes, pontos)")
    .eq("escola_id", ctx.escolaId)
    .eq("turma_id", ctx.turmaId)
    .eq("status", "publicada")
    .order("prazo", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });

  const activityIds = (data ?? []).map((item: any) => item.id);
  const planIds = Array.from(new Set((data ?? []).map((item: any) => item.plano_aula_id).filter(Boolean)));
  const { data: plans } = planIds.length
    ? await (supabase as any).from("planos_aula").select("id, data, tema, subtema, objetivos, competencias, conteudos, metodologia, recursos, atividades, avaliacao, tarefa_casa, anotacoes_alunos_avaliados, observacoes").eq("escola_id", ctx.escolaId).eq("status", "aprovado").in("id", planIds)
    : { data: [] };
  const planMap = new Map((plans ?? []).map((plan: any) => [plan.id, plan]));
  const { data: submissions } = activityIds.length
    ? await (supabase as any)
        .from("atividade_entregas")
        .select("id, atividade_id, tentativa, estado, nota, feedback, submitted_at, updated_at")
        .eq("escola_id", ctx.escolaId)
        .eq("aluno_id", ctx.alunoId)
        .in("atividade_id", activityIds)
        .order("tentativa", { ascending: false })
    : { data: [] };

  const latestByActivity = new Map<string, any>();
  for (const submission of submissions ?? []) {
    if (!latestByActivity.has(submission.atividade_id)) latestByActivity.set(submission.atividade_id, submission);
  }
  return noStore({
    ok: true,
    items: (data ?? []).map((item: any) => ({ ...item, plano_aula: item.plano_aula_id ? planMap.get(item.plano_aula_id) ?? null : null, ultima_entrega: latestByActivity.get(item.id) ?? null })),
  });
}
