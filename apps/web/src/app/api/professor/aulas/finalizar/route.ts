import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { dispatchSecretariaNotificacao } from "@/lib/notificacoes/dispatchSecretariaNotificacao";
import { isWithinSchoolLessonWindow } from "@/lib/professor/lessonWindow";

const Body = z.object({
  aula_id: z.string().uuid(),
  resumo: z.string().trim().max(5000).optional().nullable(),
  observacoes: z.string().trim().max(5000).optional().nullable(),
  conteudo: z.string().trim().max(5000).optional().nullable(),
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", auth.user.id).maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });

  const { data: aula } = await supabase.from("aulas").select("data, inicio_previsto, fim_previsto").eq("id", parsed.data.aula_id).eq("escola_id", escolaId).eq("professor_id", professor.id).maybeSingle();
  if (!aula) return NextResponse.json({ ok: false, error: "Aula não encontrada" }, { status: 404 });
  if (!isWithinSchoolLessonWindow(aula.data, aula.inicio_previsto, aula.fim_previsto)) {
    return NextResponse.json({ ok: false, error: "A aula só pode ser finalizada durante o horário desta disciplina." }, { status: 409 });
  }

  const { data, error } = await supabase.rpc("professor_finalizar_aula", {
    p_escola_id: escolaId,
    p_aula_id: parsed.data.aula_id,
    p_professor_id: professor.id,
    p_resumo: parsed.data.resumo ?? null,
    p_observacoes: parsed.data.observacoes ?? null,
    p_conteudo: parsed.data.conteudo ?? null,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "42501" ? 403 : 409 });
  await dispatchSecretariaNotificacao({
    supabase,
    escolaId,
    key: "AULA_FINALIZADA",
    actorId: auth.user.id,
    actorRole: "professor",
    params: { actionUrl: "/secretaria/aulas" },
  });
  return NextResponse.json({ ok: true, aula: data });
}
