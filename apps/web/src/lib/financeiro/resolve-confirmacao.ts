import { resolveTabelaPreco, type TabelaPreco } from "./tabela-preco";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type ResolveConfirmacaoParams = {
  escolaId: string;
  anoLetivo: number | string;
  cursoId?: string | null;
  classeId?: string | null;
  valorGlobal: number | null | undefined;
};

/**
 * Resolve a taxa da classe. Um valor gravado (inclusive 0) é explícito;
 * quando a coluna está NULL ou não existe regra, mantém o fallback global.
 */
export async function resolveValorConfirmacao(
  client: SupabaseClient<Database>,
  params: ResolveConfirmacaoParams,
): Promise<{ valor: number; tabela: TabelaPreco | null; origem: "classe" | "fallback" }> {
  const resolved = await resolveTabelaPreco(client, {
    escolaId: params.escolaId,
    anoLetivo: params.anoLetivo,
    cursoId: params.cursoId,
    classeId: params.classeId,
    allowMensalidadeFallback: false,
  });
  const configured = resolved.tabela?.valor_confirmacao;
  if (configured !== null && configured !== undefined && Number.isFinite(Number(configured))) {
    return {
      valor: Math.max(0, Number(configured)),
      tabela: resolved.tabela,
      origem: resolved.origem === "especifica" || resolved.origem === "classe" ? "classe" : "fallback",
    };
  }
  return { valor: Math.max(0, Number(params.valorGlobal ?? 0)), tabela: resolved.tabela, origem: "fallback" };
}
