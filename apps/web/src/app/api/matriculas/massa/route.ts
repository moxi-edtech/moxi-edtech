import { NextRequest, NextResponse } from "next/server";
import { buildTurmaCode } from "@/lib/turma";
import type { MatriculaMassaPayload } from "~types/matricula";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServerTyped<any>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let payload: MatriculaMassaPayload;
  try {
    payload = (await request.json()) as MatriculaMassaPayload;
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400 }
    );
  }

  const {
    import_id,
    escola_id,
    curso_codigo,
    classe_numero,
    turno_codigo,
    turma_letra,
    ano_letivo,
    turma_id,
  } = payload;

  if (!import_id || !escola_id || !curso_codigo || !classe_numero || !turno_codigo || !turma_letra || !ano_letivo) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes no payload" },
      { status: 400 }
    );
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

  let turmaCode: string;
  try {
    turmaCode = buildTurmaCode({
      courseCode: String(curso_codigo),
      classNum: classe_numero,
      shift: turno_codigo,
      section: String(turma_letra),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "TurmaCode inválido" }, { status: 400 });
  }

  let resolvedTurmaId = turma_id;
  try {
    const { data: turmaRow, error: turmaErr } = await (supabase as any).rpc("create_or_get_turma_by_code", {
      p_escola_id: escola_id,
      p_ano_letivo: ano_letivo,
      p_turma_code: turmaCode,
    });
    if (turmaErr) throw turmaErr;
    const turmaData = Array.isArray(turmaRow) ? turmaRow[0] : turmaRow;
    resolvedTurmaId = (turmaData as any)?.id || resolvedTurmaId;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Falha ao resolver turma" }, { status: 400 });
  }

  if (!resolvedTurmaId) {
    return NextResponse.json({ error: "Turma não encontrada" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("matricular_em_massa", {
    p_import_id: import_id,
    p_escola_id: escola_id,
    p_curso_codigo: curso_codigo,
    p_classe_numero: classe_numero,
    p_turno_codigo: turno_codigo,
    p_turma_letra: turma_letra,
    p_ano_letivo: ano_letivo,
    p_turma_id: resolvedTurmaId,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  type RpcResult = { success_count: number; error_count: number; errors: unknown };
  const result = (Array.isArray(data) && data.length ? data[0] : data) as Partial<RpcResult> | null;

  // Confirma todas as matrículas criadas para este import/turma pelo caminho canônico
  const { data: matriculasCriadas } = await supabase
    .from('matriculas')
    .select('id')
    .eq('escola_id', escola_id)
    .eq('import_id', import_id)
    .eq('turma_id', resolvedTurmaId);

  const confirm_errors: Array<{ id: string; error: string }> = [];
  if (matriculasCriadas && matriculasCriadas.length > 0) {
    for (const row of matriculasCriadas) {
      const { error: cErr } = await (supabase as any).rpc('confirmar_matricula', {
        p_matricula_id: row.id,
      });
      if (cErr) confirm_errors.push({ id: row.id as string, error: cErr.message });
    }
  }

  recordAuditServer({
    escolaId: escola_id,
    portal: "admin_escola",
    acao: "MATRICULA_MASSA",
    entity: "matriculas",
    details: {
      import_id,
      turma_id: resolvedTurmaId,
      success_count: result?.success_count ?? 0,
      error_count: result?.error_count ?? 0,
    },
  }).catch(() => null);

  return NextResponse.json({
    success_count: result?.success_count ?? 0,
    error_count: result?.error_count ?? 0,
    errors: (result?.errors as unknown[]) ?? [],
    confirm_errors,
  });
}
