import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QuestionSchema = z.object({
  ordem: z.number().int().min(1).max(100),
  tipo: z.enum(["escolha_unica", "verdadeiro_falso", "resposta_curta"]),
  enunciado: z.string().trim().min(2).max(10_000),
  opcoes: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  resposta_correta: z.unknown().nullable().optional(),
  pontos: z.number().positive().max(100).default(1),
});

const ActivitySchema = z.object({
  titulo: z.string().trim().min(2).max(180),
  instrucoes: z.string().trim().max(10_000).nullable().optional(),
  tipo: z.enum(["quiz", "exercicio", "tarefa", "simulado"]),
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  aula_id: z.string().uuid().nullable().optional(),
  plano_aula_id: z.string().uuid().nullable().optional(),
  ano_letivo_id: z.string().uuid().nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
  tentativas_permitidas: z.number().int().min(1).max(10).default(1),
  nota_maxima: z.number().positive().max(100).default(20),
  source_material_ids: z.array(z.string().uuid()).max(20).default([]),
  questoes: z.array(QuestionSchema).min(1).max(100),
  publicar: z.boolean().default(false),
});

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

async function context() {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, escolaId: null, professorId: null };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return { supabase, user, escolaId: null, professorId: null };
  const { data: professor } = await supabase
    .from("professores")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("profile_id", user.id)
    .maybeSingle();
  return { supabase, user, escolaId, professorId: professor?.id ?? null };
}

export async function GET() {
  const { supabase, user, escolaId, professorId } = await context();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId || !professorId) return noStore({ ok: false, error: "Professor não encontrado" }, { status: 403 });

  const { data: assignments } = await supabase
    .from("turma_disciplinas_professores")
    .select("turma_id, disciplina_id")
    .eq("escola_id", escolaId)
    .eq("professor_id", professorId)
    .limit(50);
  const allowed = new Set((assignments ?? []).map((row: any) => `${row.turma_id}:${row.disciplina_id}`));

  const { data, error } = await supabase
    .from("atividades_pedagogicas")
    .select("id, titulo, instrucoes, tipo, turma_id, disciplina_id, aula_id, plano_aula_id, ano_letivo_id, status, prazo, tentativas_permitidas, nota_maxima, published_at, created_at, atividade_questoes(id, ordem, tipo, enunciado, opcoes, pontos)")
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });
  return noStore({ ok: true, items: (data ?? []).filter((row: any) => allowed.has(`${row.turma_id}:${row.disciplina_id}`)) });
}

export async function POST(request: Request) {
  const { supabase, user, escolaId, professorId } = await context();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId || !professorId) return noStore({ ok: false, error: "Professor não encontrado" }, { status: 403 });

  const parsed = ActivitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Dados da actividade inválidos" }, { status: 400 });
  const input = parsed.data;
  const { data: assignment } = await supabase
    .from("turma_disciplinas_professores")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("professor_id", professorId)
    .eq("turma_id", input.turma_id)
    .eq("disciplina_id", input.disciplina_id)
    .maybeSingle();
  if (!assignment) return noStore({ ok: false, error: "Não lecciona esta disciplina nesta turma" }, { status: 403 });

  if (input.plano_aula_id) {
    const { data: plan } = await supabase.from("planos_aula").select("id").eq("id", input.plano_aula_id).eq("escola_id", escolaId).eq("professor_id", professorId).eq("turma_disciplina_id", assignment.id).maybeSingle();
    if (!plan) return noStore({ ok: false, error: "O plano de aula não pertence a esta turma/disciplina" }, { status: 400 });
  }
  if (input.aula_id) {
    const { data: aula } = await supabase.from("aulas").select("id, turma_disciplina_id, professor_id").eq("id", input.aula_id).eq("escola_id", escolaId).maybeSingle();
    if (!aula || aula.turma_disciplina_id !== assignment.id || aula.professor_id !== professorId) return noStore({ ok: false, error: "A aula não pertence ao professor nesta turma/disciplina" }, { status: 400 });
  }

  if (input.source_material_ids.length > 0) {
    const { count } = await supabase
      .from("materiais_pedagogicos")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("created_by", user.id)
      .in("id", input.source_material_ids);
    if (count !== input.source_material_ids.length) {
      return noStore({ ok: false, error: "Um ou mais materiais não pertencem ao professor" }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const { questoes, publicar, ...activity } = input;
  const { data: created, error } = await supabase
    .from("atividades_pedagogicas")
    .insert({
      escola_id: escolaId,
      created_by: user.id,
      ...activity,
      status: publicar ? "publicada" : "rascunho",
      published_at: publicar ? now : null,
    })
    .select("id, titulo, tipo, turma_id, disciplina_id, status, prazo, published_at, created_at")
    .single();
  if (error || !created) return noStore({ ok: false, error: error?.message ?? "Falha ao criar actividade" }, { status: 400 });

  const { error: questionsError } = await supabase.from("atividade_questoes").insert(
    questoes.map((question) => ({ escola_id: escolaId, atividade_id: created.id, ...question }))
  );
  if (questionsError) {
    // Mantém o rascunho retomável, mas remove questões parciais para não publicar uma actividade inconsistente.
    await supabase.from("atividade_questoes").delete().eq("escola_id", escolaId).eq("atividade_id", created.id);
    return noStore({
      ok: false,
      error: "Não foi possível guardar todas as questões.",
      activity_id: created.id,
      next_action: { type: "resume_draft", label: "Retomar rascunho", href: `/professor/atividades/${created.id}` },
    }, { status: 409 });
  }
  return noStore({ ok: true, item: created }, { status: 201 });
}
