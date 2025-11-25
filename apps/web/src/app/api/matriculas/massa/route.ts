import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
    !ano_letivo ||
    !turma_id
  ) {
    return NextResponse.json(
      { error: "Campos obrigatórios ausentes no payload" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("matricular_em_massa", {
    p_import_id: import_id,
    p_escola_id: escola_id,
    p_curso_codigo: curso_codigo,
    p_classe_numero: classe_numero,
    p_turno_codigo: turno_codigo,
    p_turma_letra: turma_letra,
    p_ano_letivo: ano_letivo,
    p_turma_id: turma_id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  const result = Array.isArray(data) && data.length ? data[0] : data;

  return NextResponse.json({
    success_count: result?.success_count ?? 0,
    error_count: result?.error_count ?? 0,
    errors: result?.errors ?? [],
  });
}