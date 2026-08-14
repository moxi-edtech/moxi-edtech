import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchSecretariaNotificacao } from "@/lib/notificacoes/dispatchSecretariaNotificacao";
import { isWithinSchoolLessonWindow } from "@/lib/professor/lessonWindow";

const Body = z.object({
  aula_id: z.string().uuid().optional(),
  turma_id: z.string().uuid().optional(),
  disciplina_id: z.string().uuid().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  slot_id: z.string().uuid().optional(),
  inicio_previsto: z.string().optional(),
  fim_previsto: z.string().optional(),
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const body = parsed.data;
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });

  const { data: professor } = await supabase
    .from("professores")
    .select("id")
    .eq("escola_id", escolaId)
    .eq("profile_id", auth.user.id)
    .maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });

  let lessonDate = body.data ?? null;
  let lessonStart = body.inicio_previsto ?? null;
  let lessonEnd = body.fim_previsto ?? null;
  if (body.aula_id) {
    const { data: aula } = await supabase
      .from("aulas")
      .select("data, inicio_previsto, fim_previsto")
      .eq("id", body.aula_id)
      .eq("escola_id", escolaId)
      .eq("professor_id", professor.id)
      .maybeSingle();
    if (!aula) return NextResponse.json({ ok: false, error: "Aula não encontrada" }, { status: 404 });
    lessonDate = aula.data;
    lessonStart = aula.inicio_previsto;
    lessonEnd = aula.fim_previsto;
  } else if (body.slot_id) {
    const { data: slot } = await supabase.from("horario_slots").select("inicio, fim").eq("id", body.slot_id).eq("escola_id", escolaId).maybeSingle();
    lessonStart = slot?.inicio ?? lessonStart;
    lessonEnd = slot?.fim ?? lessonEnd;
  }
  if (!isWithinSchoolLessonWindow(lessonDate, lessonStart, lessonEnd)) {
    return NextResponse.json({ ok: false, error: "A aula só pode ser iniciada durante o horário desta disciplina." }, { status: 409 });
  }

  if (!body.aula_id) {
    if (!body.turma_id || !body.disciplina_id || !body.data) {
      return NextResponse.json({ ok: false, error: "Informe aula_id ou turma, disciplina e data" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("professor_iniciar_aula_contexto", {
      p_escola_id: escolaId,
      p_professor_id: professor.id,
      p_turma_id: body.turma_id,
      p_disciplina_id: body.disciplina_id,
      p_data: body.data,
      p_slot_id: body.slot_id ?? null,
      p_inicio_previsto: body.inicio_previsto ?? null,
      p_fim_previsto: body.fim_previsto ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "42501" ? 403 : 409 });
    await dispatchSecretariaNotificacao({
      supabase,
      escolaId,
      key: "AULA_INICIADA",
      actorId: auth.user.id,
      actorRole: "professor",
      params: { actionUrl: "/secretaria/aulas" },
    });
    return NextResponse.json({ ok: true, aula: data });
  }

  let aulaId = body.aula_id ?? null;
  if (!aulaId) {
    if (!body.turma_id || !body.disciplina_id || !body.data) {
      return NextResponse.json({ ok: false, error: "Informe aula_id ou turma, disciplina e data" }, { status: 400 });
    }

    const { data: turma } = await supabase
      .from("turmas")
      .select("id, curso_id, classe_id")
      .eq("id", body.turma_id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!turma?.curso_id || !turma?.classe_id) return NextResponse.json({ ok: false, error: "Turma inválida" }, { status: 404 });

    const { data: matriz } = await supabase
      .from("curso_matriz")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("curso_id", turma.curso_id)
      .eq("classe_id", turma.classe_id)
      .eq("disciplina_id", body.disciplina_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!matriz?.id) return NextResponse.json({ ok: false, error: "Disciplina não pertence à turma" }, { status: 404 });

    const { data: turmaDisciplina } = await supabase
      .from("turma_disciplinas")
      .select("id, professor_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", body.turma_id)
      .eq("curso_matriz_id", matriz.id)
      .maybeSingle();
    if (!turmaDisciplina?.id) return NextResponse.json({ ok: false, error: "Atribuição não encontrada" }, { status: 404 });

    const { data: sharedAssignment } = await supabase
      .from("turma_disciplinas_professores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("turma_id", body.turma_id)
      .eq("disciplina_id", body.disciplina_id)
      .eq("professor_id", professor.id)
      .limit(1);
    if (turmaDisciplina.professor_id !== professor.id && !((sharedAssignment ?? []).length > 0)) {
      return NextResponse.json({ ok: false, error: "Professor não atribuído a esta disciplina" }, { status: 403 });
    }

    const lookup = supabase
      .from("aulas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("turma_disciplina_id", turmaDisciplina.id)
      .eq("data", body.data);
    const { data: existing } = body.slot_id ? await lookup.eq("slot_id", body.slot_id).maybeSingle() : await lookup.is("slot_id", null).maybeSingle();
    if (existing?.id) {
      aulaId = existing.id;
    } else {
      const { data: created, error: createError } = await supabase
        .from("aulas")
        .insert({
          escola_id: escolaId,
          turma_disciplina_id: turmaDisciplina.id,
          data: body.data,
          slot_id: body.slot_id ?? null,
          professor_id: professor.id,
          inicio_previsto: body.inicio_previsto ?? null,
          fim_previsto: body.fim_previsto ?? null,
          status: "aguardando_confirmacao",
          created_by: auth.user.id,
        })
        .select("id")
        .single();
      if (createError || !created?.id) return NextResponse.json({ ok: false, error: createError?.message ?? "Não foi possível criar a aula" }, { status: 400 });
      aulaId = created.id;
    }
  }

  const { data, error } = await supabase.rpc("professor_iniciar_aula", {
    p_escola_id: escolaId,
    p_aula_id: aulaId,
    p_professor_id: professor.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "42501" ? 403 : 409 });
  return NextResponse.json({ ok: true, aula: data });
}
