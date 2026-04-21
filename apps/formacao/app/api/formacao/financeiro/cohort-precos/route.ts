import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const [{ data: cohorts, error: cohortsError }, { data: refs, error: refsError }] = await Promise.all([
    s
      .from("formacao_cohorts")
      .select("id, codigo, nome, curso_nome, status, data_inicio, data_fim")
      .eq("escola_id", auth.escolaId)
      .order("data_inicio", { ascending: false })
      .limit(300),
    s
      .from("formacao_cohort_financeiro")
      .select("cohort_id, valor_referencia, moeda")
      .eq("escola_id", auth.escolaId),
  ]);

  if (cohortsError) {
    return NextResponse.json({ ok: false, error: cohortsError.message }, { status: 400 });
  }

  if (refsError) {
    return NextResponse.json({ ok: false, error: refsError.message }, { status: 400 });
  }

  const refMap = new Map(
    (refs ?? []).map((row) => {
      const value = row as { cohort_id: string; valor_referencia: number; moeda: string };
      return [value.cohort_id, value];
    })
  );

  const items = (cohorts ?? []).map((cohort) => {
    const typed = cohort as {
      id: string;
      codigo: string;
      nome: string;
      curso_nome: string;
      status: string;
      data_inicio: string;
      data_fim: string;
    };

    const ref = refMap.get(typed.id);
    return {
      id: typed.id,
      codigo: typed.codigo,
      nome: typed.nome,
      curso_nome: typed.curso_nome,
      status: typed.status,
      data_inicio: typed.data_inicio,
      data_fim: typed.data_fim,
      valor_referencia: ref?.valor_referencia ?? null,
      moeda: ref?.moeda ?? "AOA",
    };
  });

  return NextResponse.json({ ok: true, items });
}
