import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  // 1. Fetch original cohort
  const { data: original, error: fetchError } = await s
    .from("formacao_cohorts")
    .select("*")
    .eq("id", id)
    .eq("escola_id", auth.escolaId)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ ok: false, error: "Turma original não encontrada" }, { status: 404 });
  }

  // 2. Insert new cohort (copying most fields)
  const { data: duplicate, error: insertError } = await s
    .from("formacao_cohorts")
    .insert({
      escola_id: auth.escolaId,
      curso_id: original.curso_id,
      codigo: `${original.codigo}-COPY`,
      nome: `${original.nome} (Cópia)`,
      curso_nome: original.curso_nome,
      carga_horaria_total: original.carga_horaria_total,
      vagas: original.vagas,
      data_inicio: original.data_inicio, // User will likely change this later
      data_fim: original.data_fim,
      status: "planeada",
      visivel_na_landing: original.visivel_na_landing,
    })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });

  // 3. Duplicate modules (snapshot)
  const { data: modulos } = await s
    .from("formacao_cohort_modulos")
    .select("ordem, titulo, carga_horaria, descricao, curso_id")
    .eq("cohort_id", id);

  if (modulos && modulos.length > 0) {
    await s.from("formacao_cohort_modulos").insert(
      modulos.map(m => ({
        ...m,
        escola_id: auth.escolaId,
        cohort_id: duplicate.id
      }))
    );
  }

  // 4. Duplicate reference finance
  const { data: finance } = await s
    .from("formacao_cohort_financeiro")
    .select("valor_referencia, moeda")
    .eq("cohort_id", id)
    .maybeSingle();

  if (finance) {
    await s.from("formacao_cohort_financeiro").insert({
      escola_id: auth.escolaId,
      cohort_id: duplicate.id,
      user_id: auth.userId,
      valor_referencia: finance.valor_referencia,
      moeda: finance.moeda
    });
  }

  return NextResponse.json({ ok: true, item: duplicate });
}
