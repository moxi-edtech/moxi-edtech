import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import type { GrupoMatricula } from "~types/matricula";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ importId: string }> }
) {
  const supabase = await createRouteClient();

  // opcional: validar user/escola via sessão aqui se quiser
  const { importId } = await params;

  const { data, error } = await supabase
    .from("staging_alunos")
    .select(
      `
      id,
      import_id,
      escola_id,
      nome,
      data_nascimento,
      profile_id,
      numero_matricula,
      turma_codigo,
      ano_letivo
    `
    )
    .eq("import_id", importId)
    .not("turma_codigo", "is", null)
    .order("ano_letivo", { ascending: false })
    .order("turma_codigo", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const gruposMap = new Map<string, GrupoMatricula>();

  for (const row of data ?? []) {
    const key = [
      (row.turma_codigo || "").toString().trim().toUpperCase(),
      row.ano_letivo ?? "",
    ].join("|");

    if (!gruposMap.has(key)) {
      gruposMap.set(key, {
        import_id: row.import_id,
        escola_id: row.escola_id,
        turma_codigo: row.turma_codigo,
        ano_letivo: row.ano_letivo,
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

  return NextResponse.json({
    grupos: Array.from(gruposMap.values()),
  });
}
