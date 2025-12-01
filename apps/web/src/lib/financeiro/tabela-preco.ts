import type { SupabaseClient } from "@supabase/supabase-js";

export type TabelaPreco = {
  id: string;
  escola_id: string;
  ano_letivo: number;
  curso_id: string | null;
  classe_id: string | null;
  valor_matricula: number | null;
  valor_mensalidade: number | null;
  dia_vencimento: number | null;
  multa_atraso_percentual?: number | null;
};

export type TabelaPrecoResultado = {
  tabela: TabelaPreco | null;
  origem: "especifica" | "curso" | "classe" | "geral" | "nenhuma";
};

export async function resolveTabelaPreco(
  client: SupabaseClient<any>,
  params: {
    escolaId: string;
    anoLetivo: number | string;
    cursoId?: string | null;
    classeId?: string | null;
  }
): Promise<TabelaPrecoResultado> {
  const ano = typeof params.anoLetivo === "string" ? Number(params.anoLetivo) : params.anoLetivo;
  const anoLetivo = Number.isFinite(ano) ? Number(ano) : new Date().getFullYear();
  const cursoId = params.cursoId || null;
  const classeId = params.classeId || null;

  // 1) Específico (Curso + Classe)
  if (cursoId && classeId) {
    const { data } = await client
      .from("financeiro_tabelas")
      .select("*")
      .eq("escola_id", params.escolaId)
      .eq("ano_letivo", anoLetivo)
      .eq("curso_id", cursoId)
      .eq("classe_id", classeId)
      .maybeSingle();
    if (data) return { tabela: data as any, origem: "especifica" };
  }

  // 2) Por Curso
  if (cursoId) {
    const { data } = await client
      .from("financeiro_tabelas")
      .select("*")
      .eq("escola_id", params.escolaId)
      .eq("ano_letivo", anoLetivo)
      .eq("curso_id", cursoId)
      .is("classe_id", null)
      .maybeSingle();
    if (data) return { tabela: data as any, origem: "curso" };
  }

  // 3) Por Classe
  if (classeId) {
    const { data } = await client
      .from("financeiro_tabelas")
      .select("*")
      .eq("escola_id", params.escolaId)
      .eq("ano_letivo", anoLetivo)
      .is("curso_id", null)
      .eq("classe_id", classeId)
      .maybeSingle();
    if (data) return { tabela: data as any, origem: "classe" };
  }

  // 4) Geral
  {
    const { data } = await client
      .from("financeiro_tabelas")
      .select("*")
      .eq("escola_id", params.escolaId)
      .eq("ano_letivo", anoLetivo)
      .is("curso_id", null)
      .is("classe_id", null)
      .maybeSingle();
    if (data) return { tabela: data as any, origem: "geral" };
  }

  return { tabela: null, origem: "nenhuma" };
}
