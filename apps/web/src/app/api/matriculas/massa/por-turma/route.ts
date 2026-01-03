import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function POST(request: NextRequest) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
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
  const supabase = createAdminClient<Database>(adminUrl, serviceKey);
  let finalTurmaId = turma_id;

  if (!finalTurmaId) {
    if (!turma_code || !ano_letivo) {
      return NextResponse.json({ error: "turma_id ou (turma_code + ano_letivo) são obrigatórios" }, { status: 400 });
    }
    const { data: turmaRow, error: turmaErr } = await (supabase as any).rpc("create_or_get_turma_by_code", {
      p_escola_id: escola_id,
      p_ano_letivo: ano_letivo,
      p_turma_code: turma_code,
    });
    if (turmaErr) return NextResponse.json({ error: turmaErr.message }, { status: 400 });
    const turmaData = Array.isArray(turmaRow) ? turmaRow[0] : turmaRow;
    finalTurmaId = turmaData?.id as string | undefined;
    if (!finalTurmaId) return NextResponse.json({ error: "Falha ao resolver turma" }, { status: 400 });
  }

  const { data, error } = await (supabase as any).rpc("matricular_em_massa_por_turma", {
    p_import_id: import_id,
    p_escola_id: escola_id,
    p_turma_id: finalTurmaId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const row = Array.isArray(data) && data.length ? data[0] : data;

  // Confirma matrículas criadas para o import/turma pelo fluxo oficial
  const { data: matriculasCriadas } = await (supabase as any)
    .from('matriculas')
    .select('id')
    .eq('escola_id', escola_id)
    .eq('import_id', import_id)
    .eq('turma_id', finalTurmaId);

  let confirm_errors: Array<{ id: string; error: string }> = [];
  if (matriculasCriadas && matriculasCriadas.length > 0) {
    for (const m of matriculasCriadas) {
      const { error: cErr } = await (supabase as any).rpc('confirmar_matricula', {
        p_matricula_id: m.id,
      });
      if (cErr) confirm_errors.push({ id: m.id as string, error: cErr.message });
    }
  }

  return NextResponse.json({
    ok: true,
    success_count: row?.success_count ?? 0,
    error_count: row?.error_count ?? 0,
    errors: row?.errors ?? [],
    confirm_errors,
  });
}
