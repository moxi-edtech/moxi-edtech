import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import type { Database } from "~types/supabase";
import type { GrupoMatricula } from "~types/matricula";

export async function GET(
  _req: Request,
  { params }: { params: { importId: string } }
) {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !serviceKey) {
    return NextResponse.json(
      { error: "SUPABASE configuration missing" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient<Database>(adminUrl, serviceKey);
  const importId = params.importId;

  // Carrega registros do staging com dimensões de matrícula preenchidas
  const { data: rows, error } = await supabase
    .from("staging_alunos")
    .select(
      `
      id,
      import_id,
      escola_id,
      nome,
      data_nascimento,
      numero_matricula,
      curso_codigo,
      classe_numero,
      turno_codigo,
      turma_letra,
      ano_letivo
    `
    )
    .eq("import_id", importId)
    .not("ano_letivo", "is", null)
    .not("classe_numero", "is", null)
    .order("ano_letivo", { ascending: false })
    .order("curso_codigo")
    .order("classe_numero")
    .order("turno_codigo")
    .order("turma_letra");

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const groupsMap = new Map<string, GrupoMatricula>();

  for (const row of rows ?? []) {
    const key = [
      row.curso_codigo ?? "SEM_CURSO",
      row.classe_numero ?? "SEM_CLASSE",
      row.turno_codigo ?? "SEM_TURNO",
      row.turma_letra ?? "SEM_TURMA",
      row.ano_letivo ?? "SEM_ANO",
    ].join("|");

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        import_id: row.import_id,
        escola_id: row.escola_id,
        curso_codigo: row.curso_codigo ?? undefined,
        classe_numero: row.classe_numero ?? undefined,
        turno_codigo: row.turno_codigo ?? undefined,
        turma_letra: row.turma_letra ?? undefined,
        ano_letivo: row.ano_letivo ?? undefined,
        count: 0,
        alunos: [],
      });
    }

    const group = groupsMap.get(key)!;
    group.count += 1;

    if (group.alunos.length < 20) {
      group.alunos.push({
        id: row.id, // Changed from staging_id to id
        nome: row.nome ?? undefined,
        data_nascimento: row.data_nascimento ?? undefined,
        numero_matricula: row.numero_matricula ?? undefined,
      });
    }
  }

  return NextResponse.json({
    grupos: Array.from(groupsMap.values()),
  });
}