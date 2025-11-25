import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import type { Turma } from "~types/turma";

export async function GET(
  req: NextRequest,
  { params }: { params: { escolaId: string } }
) {
  const supabase = createRouteClient();
  const escolaId = params.escolaId;

  const { data, error } = await supabase
    .from("turmas")
    .select(
      `
      id,
      nome,
      escola_id,
      ano_letivo,
      curso:curso_id (
        id,
        codigo,
        nome
      ),
      classe:classe_id (
        id,
        numero,
        nome
      ),
      turno:turno_id (
        id,
        codigo,
        nome
      )
    `
    )
    .eq("escola_id", escolaId)
    .order("ano_letivo", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    turmas: (data ?? []) as Turma[],
  });
}