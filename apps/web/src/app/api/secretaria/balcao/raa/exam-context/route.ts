import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Only existing official sessions and curriculum assignments are returned.
// The source enrolment (not the target enrolment year) anchors the context.
const roles = ["professor", "secretaria", "admin", "admin_escola", "staff_admin", "diretor"] as const;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = z.string().uuid().safeParse(params.get("matricula_id"));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola indisponível." }, { status: 403 });
  const access = await requireRoleInSchool({ supabase, escolaId, roles: [...roles] });
  if (access.error) return access.error;

  const { data: matricula, error: matriculaError } = await supabase.from("matriculas")
    .select("id,aluno_id,turma_id,session_id,status")
    .eq("escola_id", escolaId).eq("id", parsed.data).maybeSingle();
  if (matriculaError) return NextResponse.json({ ok: false, error: "Não foi possível confirmar a matrícula." }, { status: 503 });
  if (!matricula || !matricula.turma_id || !matricula.session_id) {
    return NextResponse.json({ ok: false, error: "Não existe vínculo válido para este ano letivo." }, { status: 404 });
  }
  const [{ data: disciplinas, error: dError }, { data: sessoes, error: sError }, { data: resultados, error: rError }] = await Promise.all([
    supabase.from("turma_disciplinas").select("id,avaliacao_disciplina_id")
      .eq("escola_id", escolaId).eq("turma_id", matricula.turma_id).limit(100),
    supabase.from("exame_sessoes").select("id,tipo,estado,data_inicio,data_fim,turma_id,ano_letivo_id,exame_componentes(id,codigo,nota_max)")
      .eq("escola_id", escolaId).eq("ano_letivo_id", matricula.session_id)
      .in("tipo", ["recurso", "extraordinario"])
      .in("estado", ["aberta", "publicada"])
      .or("turma_id.is.null,turma_id.eq." + matricula.turma_id)
      .order("data_inicio", { ascending: true }).limit(50),
    // Existing exam results belong to the origin enrollment, not to the current
    // UI selection. Prevent the operator from accidentally re-submitting a
    // component whose authoritative outcome is already recorded.
    supabase.from("exame_resultados")
      .select("id,exame_sessao_id,exame_componente_id,turma_disciplina_id,estado,nota")
      .eq("escola_id", escolaId).eq("matricula_id", matricula.id).limit(200),
  ]);
  if (dError || sError || rError) return NextResponse.json({
    ok: false, error: "Não foi possível confirmar as sessões e disciplinas do RAA.",
  }, { status: 503 });

  return NextResponse.json({
    ok: true,
    source: { matricula_id: matricula.id, aluno_id: matricula.aluno_id,
      turma_id: matricula.turma_id, ano_letivo_id: matricula.session_id,
      locked: matricula.status !== "ativo" },
    disciplinas: disciplinas ?? [],
    sessoes: sessoes ?? [],
    resultados: resultados ?? [],
  });
}
