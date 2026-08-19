import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const schema = z.object({ exame_sessao_id: z.string().uuid(), disciplina_id: z.string().uuid(), motivo: z.string().trim().min(10).max(2000) });

export async function GET() {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx?.userId || !ctx.escolaId || !ctx.turmaId || ctx.anoLetivo === null) return NextResponse.json({ ok: true, sessoes: [] });
  const typed = supabase as any;
  const { data: ano } = await typed.from("anos_letivos").select("id").eq("escola_id", ctx.escolaId).eq("ano", ctx.anoLetivo).maybeSingle();
  if (!ano) return NextResponse.json({ ok: true, sessoes: [] });
  const { data, error } = await typed.from("exame_sessoes").select("id, tipo, estado, data_inicio, data_fim, observacoes").eq("escola_id", ctx.escolaId).eq("ano_letivo_id", ano.id).eq("turma_id", ctx.turmaId).eq("tipo", "recurso").in("estado", ["aberta", "publicada"]).order("data_inicio", { ascending: true }).limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, sessoes: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx?.userId || !ctx.escolaId || !ctx.matriculaId || !ctx.turmaId || ctx.anoLetivo === null) return NextResponse.json({ ok: false, error: "Matrícula ativa não encontrada." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const typed = supabase as any;
  const { data: ano } = await typed.from("anos_letivos").select("id").eq("escola_id", ctx.escolaId).eq("ano", ctx.anoLetivo).maybeSingle();
  const { data: session } = await typed.from("exame_sessoes").select("id, tipo, estado, ano_letivo_id, turma_id").eq("id", parsed.data.exame_sessao_id).eq("escola_id", ctx.escolaId).maybeSingle();
  if (!ano || !session || session.ano_letivo_id !== ano.id || session.turma_id !== ctx.turmaId || session.tipo !== "recurso" || !["aberta", "publicada"].includes(session.estado)) return NextResponse.json({ ok: false, error: "Não existe uma sessão de recurso aberta para este contexto." }, { status: 409 });
  const { data: vinculo } = await typed.from("turma_disciplinas").select("id").eq("escola_id", ctx.escolaId).eq("turma_id", ctx.turmaId).eq("avaliacao_disciplina_id", parsed.data.disciplina_id).maybeSingle();
  if (!vinculo) return NextResponse.json({ ok: false, error: "A disciplina não pertence à turma atual." }, { status: 409 });
  const { data: canonical, error: resolverError } = await (supabase as any).rpc("resolve_estado_resultado", { p_matricula_id: ctx.matriculaId, p_disciplina_id: parsed.data.disciplina_id });
  if (resolverError) return NextResponse.json({ ok: false, error: "O resolvedor académico está indisponível." }, { status: 503 });
  if (canonical?.status !== "aprovado") return NextResponse.json({ ok: false, error: "A melhoria só pode ser solicitada para um resultado académico aprovado e resolvido.", code: "RAA_MELHORIA_NOT_ELIGIBLE", canonical_result: canonical }, { status: 409 });
  const { data: item, error } = await typed.from("melhoria_nota_pedidos").insert({ escola_id: ctx.escolaId, exame_sessao_id: session.id, matricula_id: ctx.matriculaId, turma_disciplina_id: vinculo.id, nota_anterior: canonical.nota, motivo: parsed.data.motivo, solicitado_por: ctx.userId }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "Já existe um pedido de melhoria para esta sessão e disciplina." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
