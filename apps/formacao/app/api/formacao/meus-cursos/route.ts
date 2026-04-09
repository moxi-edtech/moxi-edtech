import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

type CohortMap = Record<
  string,
  {
    id: string;
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
    status: string;
  }
>;

type RawFatura = {
  referencia?: string | null;
  cohort_id?: string | null;
  emissao_em?: string | null;
  vencimento_em?: string | null;
} | null;

type RawItem = {
  id: string;
  formando_user_id: string;
  descricao: string;
  valor_total: number;
  status_pagamento: string;
  formacao_faturas_lote?: RawFatura;
};

type RawCohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  data_inicio: string;
  data_fim: string;
  status: string;
};

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formando",
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  let itemsQuery = s
    .from("formacao_faturas_lote_itens")
    .select(
      "id, formando_user_id, descricao, valor_total, status_pagamento, fatura_lote_id, formacao_faturas_lote:fatura_lote_id(id, referencia, cohort_id, emissao_em, vencimento_em)"
    )
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (auth.role === "formando") {
    itemsQuery = itemsQuery.eq("formando_user_id", auth.userId);
  }

  const { data: items, error: itemsError } = await itemsQuery;
  if (itemsError) return NextResponse.json({ ok: false, error: itemsError.message }, { status: 400 });

  const cohortIds = Array.from(
    new Set(
      ((items ?? []) as RawItem[])
        .map((item) => item?.formacao_faturas_lote?.cohort_id)
        .filter((value: unknown) => typeof value === "string" && value.length > 0)
    )
  );

  let cohortMap: CohortMap = {};
  if (cohortIds.length > 0) {
    const { data: cohorts, error: cohortsError } = await s
      .from("formacao_cohorts")
      .select("id, codigo, nome, curso_nome, data_inicio, data_fim, status")
      .eq("escola_id", auth.escolaId)
      .in("id", cohortIds);

    if (cohortsError) {
      return NextResponse.json({ ok: false, error: cohortsError.message }, { status: 400 });
    }

    cohortMap = ((cohorts ?? []) as RawCohort[]).reduce((acc: CohortMap, row) => {
      acc[row.id] = row;
      return acc;
    }, {});
  }

  const normalized = ((items ?? []) as RawItem[]).map((item) => {
    const fatura = item.formacao_faturas_lote ?? null;
    const cohortId = fatura?.cohort_id ?? null;
    return {
      id: item.id as string,
      formando_user_id: item.formando_user_id as string,
      descricao: item.descricao as string,
      valor_total: item.valor_total as number,
      status_pagamento: item.status_pagamento as string,
      referencia: (fatura?.referencia as string | null) ?? null,
      emissao_em: (fatura?.emissao_em as string | null) ?? null,
      vencimento_em: (fatura?.vencimento_em as string | null) ?? null,
      cohort: cohortId ? cohortMap[cohortId] ?? null : null,
    };
  });

  return NextResponse.json({ ok: true, items: normalized });
}
