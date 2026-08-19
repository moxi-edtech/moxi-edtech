import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const resultSchema = z.object({
  exame_sessao_id: z.string().uuid(),
  exame_componente_id: z.string().uuid(),
  matricula_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  turma_disciplina_id: z.string().uuid(),
  nota: z.number().min(0).max(100).nullable(),
  observacao: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: ["professor", "secretaria", "admin", "admin_escola", "staff_admin", "diretor"] });
  if (authz.error) return authz.error;
  const parsed = resultSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const body = parsed.data;

  const { data: session } = await supabase.from("exame_sessoes").select("id, estado, turma_id").eq("id", body.exame_sessao_id).eq("escola_id", escolaId).maybeSingle();
  if (!session) return NextResponse.json({ ok: false, error: "Sessão de exame não encontrada." }, { status: 404 });
  if (["encerrada", "cancelada"].includes(session.estado)) return NextResponse.json({ ok: false, error: "A sessão de exame não aceita novos resultados.", code: "EXAM_SESSION_LOCKED" }, { status: 409 });

  const { data: matricula } = await supabase.from("matriculas").select("id, aluno_id, turma_id").eq("id", body.matricula_id).eq("escola_id", escolaId).maybeSingle();
  if (!matricula || matricula.aluno_id !== body.aluno_id || (session.turma_id && matricula.turma_id !== session.turma_id)) {
    return NextResponse.json({ ok: false, error: "A matrícula não pertence ao aluno ou à turma da sessão." }, { status: 409 });
  }

  const { data: turmaDisciplina } = await supabase.from("turma_disciplinas").select("id, turma_id").eq("id", body.turma_disciplina_id).eq("escola_id", escolaId).maybeSingle();
  if (!turmaDisciplina || (session.turma_id && turmaDisciplina.turma_id !== session.turma_id)) {
    return NextResponse.json({ ok: false, error: "A disciplina não pertence à turma da sessão." }, { status: 409 });
  }

  const { data, error } = await supabase.from("exame_resultados").upsert({ ...body, escola_id: escolaId, estado: "submetido", lancado_por: auth.user.id, lancado_em: new Date().toISOString() }, { onConflict: "exame_sessao_id,exame_componente_id,matricula_id,turma_disciplina_id" }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true, data });
}
