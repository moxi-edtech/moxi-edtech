import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UpdateSchema = z.object({
  status: z.enum(["rascunho", "publicada", "encerrada"]).optional(),
  titulo: z.string().trim().min(2).max(180).optional(),
  instrucoes: z.string().trim().max(10_000).nullable().optional(),
  prazo: z.string().datetime().nullable().optional(),
  aula_id: z.string().uuid().nullable().optional(),
  plano_aula_id: z.string().uuid().nullable().optional(),
  tentativas_permitidas: z.number().int().min(1).max(10).optional(),
  nota_maxima: z.number().positive().max(100).optional(),
  questoes: z.array(z.object({
    ordem: z.number().int().min(1).max(100),
    tipo: z.enum(["escolha_unica", "verdadeiro_falso", "resposta_curta"]),
    enunciado: z.string().trim().min(2).max(10_000),
    opcoes: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    resposta_correta: z.unknown().nullable().optional(),
    pontos: z.number().positive().max(100).default(1),
  })).min(1).max(100).optional(),
});

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

async function teacherContext() {
  const supabase = await supabaseServerTyped<any>();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { supabase, user: null, escolaId: null };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  return { supabase, user, escolaId };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { supabase, user, escolaId } = await teacherContext();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });

  const { data: activity, error } = await supabase
    .from("atividades_pedagogicas")
    .select("id, titulo, instrucoes, tipo, turma_id, disciplina_id, aula_id, plano_aula_id, status, prazo, tentativas_permitidas, nota_maxima, published_at, created_at, atividade_questoes(id, ordem, tipo, enunciado, opcoes, pontos)")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (error) return noStore({ ok: false, error: error.message }, { status: 500 });
  if (!activity) return noStore({ ok: false, error: "Actividade não encontrada" }, { status: 404 });

  const { data: entregas, error: submissionsError } = await supabase
    .from("atividade_entregas")
    .select("id, aluno_id, tentativa, estado, nota, feedback, submitted_at, graded_at, updated_at, alunos(id, nome, nome_completo)")
    .eq("escola_id", escolaId)
    .eq("atividade_id", id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (submissionsError) return noStore({ ok: false, error: submissionsError.message }, { status: 500 });
  return noStore({ ok: true, activity, entregas: entregas ?? [] });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { supabase, user, escolaId } = await teacherContext();
  if (!user) return noStore({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return noStore({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return noStore({ ok: false, error: "Estado inválido" }, { status: 400 });

  const { data: existingActivity } = await supabase
    .from("atividades_pedagogicas")
    .select("id, turma_id, disciplina_id")
    .eq("id", id)
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .maybeSingle();
  if (!existingActivity) return noStore({ ok: false, error: "Actividade não encontrada" }, { status: 404 });
  const { data: currentProfessor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", user.id).maybeSingle();
  if (parsed.data.plano_aula_id) {
    const { data: plan } = await supabase.from("planos_aula").select("id, professor_id, turma_disciplina_id").eq("id", parsed.data.plano_aula_id).eq("escola_id", escolaId).maybeSingle();
    if (!plan || plan.professor_id !== currentProfessor?.id) return noStore({ ok: false, error: "Plano de aula inválido para este professor" }, { status: 400 });
  }
  if (parsed.data.aula_id) {
    const { data: aula } = await supabase.from("aulas").select("id, professor_id").eq("id", parsed.data.aula_id).eq("escola_id", escolaId).maybeSingle();
    if (!aula || aula.professor_id !== currentProfessor?.id) return noStore({ ok: false, error: "Aula inválida para este professor" }, { status: 400 });
  }

  const requestedStatus = parsed.data.status;
  const isPublished = requestedStatus === "publicada";
  if (isPublished) {
    const { count } = await supabase
      .from("atividade_questoes")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("atividade_id", id);
    if (!count) {
      return noStore({
        ok: false,
        error: "Adicione pelo menos uma questão antes de publicar.",
        next_action: { type: "edit_activity", label: "Editar actividade", href: `/professor/atividades/${id}` },
      }, { status: 409 });
    }
  }
  const { questoes, status, ...content } = parsed.data;
  const { data, error } = await supabase
    .from("atividades_pedagogicas")
    .update({
      ...content,
      ...(status ? { status, published_at: isPublished ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("escola_id", escolaId)
    .eq("created_by", user.id)
    .select("id, status, published_at, updated_at")
    .maybeSingle();
  if (error) return noStore({ ok: false, error: error.message }, { status: 400 });
  if (!data) return noStore({ ok: false, error: "Actividade não encontrada" }, { status: 404 });
  if (questoes) {
    const { error: deleteError } = await supabase.from("atividade_questoes").delete().eq("escola_id", escolaId).eq("atividade_id", id);
    if (deleteError) return noStore({ ok: false, error: "Não foi possível substituir as questões", next_action: { type: "resume_draft", label: "Retomar rascunho", href: `/professor/atividades/${id}` } }, { status: 409 });
    const { error: insertError } = await supabase.from("atividade_questoes").insert(questoes.map((question) => ({ escola_id: escolaId, atividade_id: id, ...question })));
    if (insertError) return noStore({ ok: false, error: "Não foi possível guardar as questões", next_action: { type: "resume_draft", label: "Retomar rascunho", href: `/professor/atividades/${id}` } }, { status: 409 });
  }
  return noStore({ ok: true, item: data });
}
