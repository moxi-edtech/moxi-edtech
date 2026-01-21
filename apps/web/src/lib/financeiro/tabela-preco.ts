import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveMensalidade } from "./pricing";

export function normalizeAnoLetivo(value: number | string | null | undefined): number {
  const currentYear = new Date().getFullYear();

  if (value === null || value === undefined || value === "") return currentYear;

  if (typeof value === "number" && Number.isFinite(value)) {
    const year = Math.trunc(value);
    if (year >= 1900 && year <= 3000) return year;
  }

  const texto = String(value).trim();
  const match = texto.match(/(19|20)\d{2}/);
  if (match && match[0]) {
    const year = Number(match[0]);
    if (year >= 1900 && year <= 3000) return year;
  }

  const digits = texto.replace(/\D+/g, "");
  const numeric = Number(digits);
  if (Number.isFinite(numeric)) {
    const year = Math.trunc(numeric);
    if (year >= 1900 && year <= 3000) return year;
  }

  return currentYear;
}

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
  origem:
    | "especifica"
    | "curso"
    | "classe"
    | "geral"
    | "mensalidade_classe"
    | "mensalidade_curso"
    | "mensalidade_escola"
    | "nenhuma";
};

export async function resolveTabelaPreco(
  client: SupabaseClient<Database>,
  params: {
    escolaId: string;
    anoLetivo: number | string;
    cursoId?: string | null;
    classeId?: string | null;
    /**
     * Quando false, não cai no fallback legado (tabelas_mensalidade).
     * Útil para fluxos que exigem tabela explícita em financeiro_tabelas.
     */
    allowMensalidadeFallback?: boolean;
  }
): Promise<TabelaPrecoResultado> {
  const anoLetivo = normalizeAnoLetivo(params.anoLetivo);
  const cursoId = params.cursoId || null;
  const classeId = params.classeId || null;
  const allowFallback = params.allowMensalidadeFallback !== false;

  const fetchTabela = async (
    filters: { cursoId?: string | null; classeId?: string | null },
    opts?: { ignoreAno?: boolean }
  ): Promise<TabelaPreco | null> => {
    const base = client.from("financeiro_tabelas").select("*").eq("escola_id", params.escolaId);
    let scoped = opts?.ignoreAno ? base : base.eq("ano_letivo", anoLetivo);

    if (filters.cursoId !== undefined) {
      scoped = filters.cursoId ? scoped.eq("curso_id", filters.cursoId) : scoped.is("curso_id", null);
    }

    if (filters.classeId !== undefined) {
      scoped = filters.classeId ? scoped.eq("classe_id", filters.classeId) : scoped.is("classe_id", null);
    }

    const prioritized = scoped
      .order("ano_letivo", { ascending: false })
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    const { data, error } = await prioritized;
    if (error && "code" in error && error.code !== "PGRST116") throw error;
    const tabela = (data?.[0] as TabelaPreco | undefined) || null;
    return tabela;
  };

  const tentarResolver = async (
    filters: { cursoId?: string | null; classeId?: string | null },
    origem: TabelaPrecoResultado["origem"],
  ): Promise<TabelaPrecoResultado | null> => {
    const tabelaAno = await fetchTabela(filters);
    if (tabelaAno) return { tabela: tabelaAno, origem };

    const tabelaMaisRecente = await fetchTabela(filters, { ignoreAno: true });
    if (tabelaMaisRecente) return { tabela: tabelaMaisRecente, origem };

    return null;
  };

  // 1) Específico (Curso + Classe)
  if (cursoId && classeId) {
    const resolved = await tentarResolver({ cursoId, classeId }, "especifica");
    if (resolved) return resolved;
  }

  // 2) Por Curso
  if (cursoId) {
    const resolved = await tentarResolver({ cursoId, classeId: null }, "curso");
    if (resolved) return resolved;
  }

  // 3) Por Classe
  if (classeId) {
    const resolved = await tentarResolver({ cursoId: null, classeId }, "classe");
    if (resolved) return resolved;
  }

  // 4) Geral
  {
    const resolved = await tentarResolver({ cursoId: null, classeId: null }, "geral");
    if (resolved) return resolved;
  }

  // 5) Fallback para tabela de mensalidade legada (opcional)
  if (allowFallback) {
    const mensalidade = await resolveMensalidade(client, params.escolaId, { cursoId, classeId });

    const valorMensalidade =
      mensalidade.valor != null ? Number(mensalidade.valor) : Number.NaN;

    if (Number.isFinite(valorMensalidade)) {
      const origem =
        mensalidade.source === "classe"
          ? "mensalidade_classe"
          : mensalidade.source === "curso"
            ? "mensalidade_curso"
            : mensalidade.source === "escola"
              ? "mensalidade_escola"
              : "nenhuma";

      return {
        tabela: {
          id: `mensalidade-${origem}`,
          escola_id: params.escolaId,
          ano_letivo: anoLetivo,
          curso_id: cursoId,
          classe_id: classeId,
          valor_matricula: null,
          valor_mensalidade: valorMensalidade,
          dia_vencimento: mensalidade.dia_vencimento ?? null,
          multa_atraso_percentual: null,
        },
        origem,
      };
    }
  }

  return { tabela: null, origem: "nenhuma" };
}
