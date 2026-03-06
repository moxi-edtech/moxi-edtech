import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { emitirComprovanteMatricula } from "@/lib/documentos/emitirComprovanteMatricula";
import { buildPlanLimitError, checkAlunoPlanLimit } from "@/lib/plan/limits";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServerTyped<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { import_id?: string; escola_id?: string; turma_id?: string; turma_code?: string; ano_letivo?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { import_id, escola_id, turma_id, turma_code, ano_letivo } = body || {};
  if (!import_id || !escola_id) {
    return NextResponse.json({ error: "import_id e escola_id são obrigatórios" }, { status: 400 });
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escola_id);
  if (!resolvedEscolaId || resolvedEscolaId !== escola_id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { error: roleError } = await requireRoleInSchool({
    supabase,
    escolaId: resolvedEscolaId,
    roles: ["admin", "admin_escola", "secretaria", "staff_admin"],
  });
  if (roleError) return roleError;

  const { count: stagedCount } = await supabase
    .from("staging_alunos")
    .select("id", { count: "exact", head: true })
    .eq("import_id", import_id)
    .eq("escola_id", escola_id);

  const limitCheck = await checkAlunoPlanLimit(supabase as any, escola_id, stagedCount ?? 0);
  if (!limitCheck.ok) {
    await supabase.from('notifications').insert({
      escola_id: escola_id,
      target_role: 'super_admin',
      tipo: 'plan_limit_alunos',
      titulo: 'Limite de alunos atingido',
      mensagem: `Matrícula em massa bloqueada (${limitCheck.current}/${limitCheck.max}).`,
      link_acao: `/super-admin/escolas/${escola_id}`,
    });

    recordAuditServer({
      escolaId: escola_id,
      portal: "admin_escola",
      acao: "PLAN_LIMIT_ALUNOS",
      entity: "matriculas",
      details: limitCheck,
    }).catch(() => null);

    return NextResponse.json(buildPlanLimitError(escola_id, limitCheck), { status: 403 });
  }
  let finalTurmaId = turma_id;

  if (!finalTurmaId) {
    if (!turma_code || !ano_letivo) {
      return NextResponse.json({ error: "turma_id ou (turma_code + ano_letivo) são obrigatórios" }, { status: 400 });
    }
    const { data: turmaRow, error: turmaErr } = await supabase.rpc("create_or_get_turma_by_code", {
      p_escola_id: escola_id,
      p_ano_letivo: ano_letivo,
      p_turma_code: turma_code,
    });
    if (turmaErr) return NextResponse.json({ error: turmaErr.message }, { status: 400 });
    const turmaData = Array.isArray(turmaRow) ? turmaRow[0] : turmaRow;
    finalTurmaId = turmaData?.id as string | undefined;
    if (!finalTurmaId) return NextResponse.json({ error: "Falha ao resolver turma" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("matricular_em_massa_por_turma", {
    p_import_id: import_id,
    p_escola_id: escola_id,
    p_turma_id: finalTurmaId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  type ImportRow = { success_count?: number; error_count?: number; errors?: unknown };
  const row = (Array.isArray(data) && data.length ? data[0] : data) as ImportRow | null;

  // Confirma matrículas criadas para o import/turma pelo fluxo oficial
  const { data: matriculasCriadas } = await supabase
    .from('matriculas')
    .select('id')
    .eq('escola_id', escola_id)
    .eq('import_id', import_id)
    .eq('turma_id', finalTurmaId);

  const confirm_errors: Array<{ id: string; error: string }> = [];
  if (matriculasCriadas && matriculasCriadas.length > 0) {
    for (const m of matriculasCriadas) {
      const { error: cErr } = await supabase.rpc('confirmar_matricula', {
        p_matricula_id: m.id,
      });
      if (cErr) {
        confirm_errors.push({ id: m.id as string, error: cErr.message });
        continue;
      }
      const comprovanteResult = await emitirComprovanteMatricula({
        supabase,
        escolaId: escola_id,
        matriculaId: String(m.id),
        dataHoraEfetivacao: new Date().toISOString(),
        createdBy: user.id,
        audit: {
          portal: "admin_escola",
          acao: "COMPROVANTE_MATRICULA_AUTOEMITIDO",
        },
      });
      if (!comprovanteResult.ok) {
        console.warn('[matriculas/massa/por-turma] comprovante não emitido:', comprovanteResult.error);
      }
    }
  }

  recordAuditServer({
    escolaId: escola_id,
    portal: "admin_escola",
    acao: "MATRICULA_MASSA_TURMA",
    entity: "matriculas",
    details: {
      import_id,
      turma_id: finalTurmaId,
      success_count: row?.success_count ?? 0,
      error_count: row?.error_count ?? 0,
    },
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    success_count: row?.success_count ?? 0,
    error_count: row?.error_count ?? 0,
    errors: row?.errors ?? [],
    confirm_errors,
  });
}
