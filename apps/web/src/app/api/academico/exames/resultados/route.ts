import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { validateRaaExamResult } from "@/lib/academico/raa-exam-result-guard";

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

  const { data: session } = await supabase.from("exame_sessoes").select("id, estado, turma_id, ano_letivo_id").eq("id", body.exame_sessao_id).eq("escola_id", escolaId).maybeSingle();
  if (!session) return NextResponse.json({ ok: false, error: "Sessão de exame não encontrada." }, { status: 404 });
  if (["encerrada", "cancelada"].includes(session.estado)) return NextResponse.json({ ok: false, error: "A sessão de exame não aceita novos resultados.", code: "EXAM_SESSION_LOCKED" }, { status: 409 });

  const { data: matricula } = await supabase.from("matriculas").select("id, aluno_id, turma_id, session_id, status").eq("id", body.matricula_id).eq("escola_id", escolaId).maybeSingle();
  if (!matricula || matricula.aluno_id !== body.aluno_id || (session.turma_id && matricula.turma_id !== session.turma_id)) {
    return NextResponse.json({ ok: false, error: "A matrícula não pertence ao aluno ou à turma da sessão." }, { status: 409 });
  }

  if (matricula.status !== "ativo") {
    return NextResponse.json({ ok: false, error: "A matrícula tem fecho legal. Faça uma reabertura académica formal.", code: "RAA_LEGAL_LOCK" }, { status: 409 });
  }
  if (matricula.session_id !== session.ano_letivo_id) {
    return NextResponse.json({ ok: false, error: "A sessão de exame não pertence ao ano letivo da matrícula.", code: "EXAM_YEAR_MISMATCH" }, { status: 409 });
  }
  const [{ data: turmaDisciplina }, { data: componente }] = await Promise.all([
    supabase.from("turma_disciplinas").select("id, turma_id")
      .eq("id", body.turma_disciplina_id).eq("escola_id", escolaId).maybeSingle(),
    supabase.from("exame_componentes").select("id, exame_sessao_id, nota_max")
      .eq("id", body.exame_componente_id).eq("escola_id", escolaId)
      .eq("exame_sessao_id", session.id).maybeSingle(),
  ]);
  if (!turmaDisciplina || turmaDisciplina.turma_id !== matricula.turma_id) {
    return NextResponse.json({ ok: false, error: "A disciplina não pertence à turma do aluno." }, { status: 409 });
  }
  if (!componente) {
    return NextResponse.json({ ok: false, error: "Componente não pertence à sessão de exame.", code: "EXAM_COMPONENT_MISMATCH" }, { status: 409 });
  }
  if (body.nota !== null && body.nota > Number(componente.nota_max)) {
    return NextResponse.json({ ok: false, error: "A nota excede o máximo do componente.", code: "EXAM_NOTE_EXCEEDS_MAX" }, { status: 422 });
  }

  // Additional single-source validation makes the legal guard testable and
  // keeps the strict context enforced even if API call sites change.
  const guard = validateRaaExamResult({
    source: matricula,
    session,
    turmaDisciplina,
    componente,
    alunoId: body.aluno_id,
    nota: body.nota,
  });
  if (guard) return NextResponse.json({
    ok: false, code: guard,
    error: "A sessão, a matrícula e o componente de exame não constituem um contexto autorizado.",
  }, { status: 409 });

  // An exam result is a legal record: no silent upsert of submitted/validated
  // grades. Duplicate retries return the same record without new writes.
  const { data: existing, error: existingError } = await supabase.from("exame_resultados")
    .select("id,estado,nota")
    .eq("escola_id", escolaId)
    .eq("exame_sessao_id", body.exame_sessao_id)
    .eq("exame_componente_id", body.exame_componente_id)
    .eq("matricula_id", body.matricula_id)
    .eq("turma_disciplina_id", body.turma_disciplina_id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: "Não foi possível confirmar o resultado existente." }, { status: 503 });
  if (existing) {
    if (existing.estado === "submetido" && Number(existing.nota) === body.nota) {
      return NextResponse.json({ ok: true, data: existing, idempotent: true });
    }
    return NextResponse.json({ ok: false,
      error: "Já existe nota para esta sessão e disciplina. A alteração exige retificação académica formal.",
      code: "EXAM_RESULT_ALREADY_RECORDED",
    }, { status: 409 });
  }
  const { data, error } = await supabase.from("exame_resultados")
    .insert({ ...body, escola_id: escolaId, estado: "submetido", lancado_por: auth.user.id, lancado_em: new Date().toISOString() })
    .select().single();
  if (error) return NextResponse.json({ ok: false,
    error: error.code === "23505" ? "Resultado já lançado por outro operador. Atualize a análise." : "Não foi possível guardar o resultado.",
    code: error.code === "23505" ? "EXAM_RESULT_CONFLICT" : "EXAM_RESULT_WRITE_FAILED",
  }, { status: error.code === "23505" ? 409 : 503 });
  return NextResponse.json({ ok: true, data });
}
