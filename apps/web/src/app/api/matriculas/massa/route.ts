import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { buildTurmaCode } from "@/lib/turma";
import type { Database } from "~types/supabase";
import type { MatriculaMassaPayload } from "~types/matricula";

export async function POST(request: NextRequest) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE configuration missing" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);

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

  if (
    !import_id ||
    !escola_id ||
    !curso_codigo ||
    !classe_numero ||
    !turno_codigo ||
    !turma_letra ||
    !ano_letivo
  ) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes no payload" },
      { status: 400 }
    );
  }

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

  return NextResponse.json({
    success_count: result?.success_count ?? 0,
    error_count: result?.error_count ?? 0,
    errors: (result?.errors as unknown[]) ?? [],
  });
}
