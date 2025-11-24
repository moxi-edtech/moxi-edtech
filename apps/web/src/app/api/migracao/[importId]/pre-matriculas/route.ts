import { NextRequest, NextResponse } from "next/server";

import { createRouteClient } from "@/lib/supabase/route-client";
import type { GrupoMatricula } from "~types/matricula";

export async function GET(
  _req: NextRequest,
  { params }: { params: { importId: string } }
) {
  const supabase = await createRouteClient();

  const { data, error } = await supabase
    .from("staging_alunos")
    .select(
      `
        id,
        nome,
        data_nascimento,
        profile_id,
        numero_matricula,
        classe_label,
        turma_label,
        ano_letivo
      `
    )
    .eq("import_id", params.importId)
    .not("classe_label", "is", null)
    .not("ano_letivo", "is", null);

  if (error) {
    console.error("[pre-matriculas] error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gruposMap = new Map<string, GrupoMatricula>();

  for (const row of data ?? []) {
    const key = `${row.classe_label ?? ""}::${row.turma_label ?? ""}::${row.ano_letivo}`;

    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        classe_label: row.classe_label!,
        turma_label: row.turma_label ?? "",
        ano_letivo: row.ano_letivo!,
        count: 0,
        alunos: [],
      });
    }

    const grupo = gruposMap.get(key)!;
    grupo.count += 1;
    grupo.alunos.push({
      id: row.id,
      nome: row.nome ?? undefined,
      data_nascimento: row.data_nascimento ?? undefined,
      profile_id: row.profile_id ?? undefined,
      numero_matricula: row.numero_matricula ?? undefined,
    });
  }

  return NextResponse.json({ grupos: Array.from(gruposMap.values()) });
}
