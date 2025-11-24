import { NextRequest, NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  const supabase = await createRouteClient();

  try {
    const payload = await request.json();

    const { data, error } = await supabase.rpc("matricular_em_massa", {
      p_import_id: payload.import_id,
      p_escola_id: payload.escola_id,
      p_classe_label: payload.classe_label,
      p_turma_label: payload.turma_label,
      p_ano_letivo: payload.ano_letivo,
      p_turma_id: payload.turma_id,
    });

    if (error) {
      console.error("[matriculas/massa] error", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const row = Array.isArray(data) && data.length ? data[0] : data;

    return NextResponse.json({
      success_count: row?.success_count ?? 0,
      error_count: row?.error_count ?? 0,
      errors: row?.errors ?? [],
    });
  } catch (err) {
    console.error("[matriculas/massa] fatal", err);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
