import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";
import { calculateReapreciacaoDeadline } from "@/lib/academico/raa-eligibility";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({
  disciplina_id: z.string().uuid(),
  motivo: z.string().trim().min(10).max(2000),
  idempotency_key: z.string().trim().min(8).max(120),
});

export async function POST(request: Request) {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx?.userId || !ctx.escolaId || !ctx.matriculaId || !ctx.turmaId) return NextResponse.json({ ok: false, error: "Matrícula ativa não encontrada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });

  if (ctx.anoLetivo === null) return NextResponse.json({ ok: false, error: "Ano letivo ativo não encontrado." }, { status: 409 });
  const { data: anoLetivo } = await supabase.from("anos_letivos").select("id").eq("escola_id", ctx.escolaId).eq("ano", ctx.anoLetivo).maybeSingle();
  if (!anoLetivo) return NextResponse.json({ ok: false, error: "Ano letivo ativo não encontrado." }, { status: 409 });

  const { data: vinculo } = await supabase.from("turma_disciplinas").select("id").eq("escola_id", ctx.escolaId).eq("turma_id", ctx.turmaId).eq("avaliacao_disciplina_id", parsed.data.disciplina_id).maybeSingle();
  if (!vinculo) return NextResponse.json({ ok: false, error: "A disciplina não pertence à turma atual." }, { status: 409 });

  const { data: canonical, error: resolverError } = await (supabase as any).rpc("resolve_estado_resultado", { p_matricula_id: ctx.matriculaId, p_disciplina_id: parsed.data.disciplina_id });
  if (resolverError) return NextResponse.json({ ok: false, error: "O resolvedor académico está indisponível." }, { status: 503 });
  if (canonical?.status !== "reprovado") return NextResponse.json({ ok: false, error: canonical?.status === "reprovado_por_indisciplina" ? "Este resultado está retido por indisciplina grave e não pode abrir reapreciação académica." : "A reapreciação só pode ser solicitada para resultado académico negativo.", code: "RAA_REAPRECIACAO_NOT_ELIGIBLE", canonical_result: canonical }, { status: 409 });

  const typedSupabase = supabase as any;
  const { data: existing } = await typedSupabase.from("reapreciacao_pedidos").select("*").eq("escola_id", ctx.escolaId).eq("idempotency_key", parsed.data.idempotency_key).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, duplicate: true, item: existing });
  const { data: active } = await typedSupabase.from("reapreciacao_pedidos").select("*").eq("escola_id", ctx.escolaId).eq("matricula_id", ctx.matriculaId).eq("turma_disciplina_id", vinculo.id).in("estado", ["pendente", "em_analise"]).maybeSingle();
  if (active) return NextResponse.json({ ok: true, duplicate: true, item: active });

  const { data: item, error } = await typedSupabase.from("reapreciacao_pedidos").insert({
    escola_id: ctx.escolaId,
    ano_letivo_id: anoLetivo.id,
    turma_id: ctx.turmaId,
    matricula_id: ctx.matriculaId,
    aluno_id: ctx.alunoId,
    turma_disciplina_id: vinculo.id,
    disciplina_id: parsed.data.disciplina_id,
    nota_referencia: typeof canonical?.nota === "number" ? canonical.nota : null,
    motivo: parsed.data.motivo,
    prazo_em: calculateReapreciacaoDeadline(new Date()).toISOString(),
    idempotency_key: parsed.data.idempotency_key,
    solicitado_por: ctx.userId,
  }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "Já existe uma solicitação ativa para este contexto." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
