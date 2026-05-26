import type { SupabaseClient } from "@supabase/supabase-js";

export type AnoLetivoScope = {
  id: string;
  ano: number;
  dataInicio: string | null;
  dataFim: string | null;
};

type ResolveParams = {
  anoLetivoId?: string | null;
  ano?: number | null;
};

function normalizeYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) return Number(value);
  return null;
}

export async function resolveAnoLetivoScope(
  supabase: SupabaseClient<any>,
  escolaId: string,
  params: ResolveParams = {}
): Promise<AnoLetivoScope | null> {
  const requestedId = params.anoLetivoId?.trim() || null;
  const requestedAno = normalizeYear(params.ano);

  let query = supabase
    .from("anos_letivos")
    .select("id, ano, data_inicio, data_fim, ativo")
    .eq("escola_id", escolaId);

  if (requestedId) {
    query = query.eq("id", requestedId);
  } else if (requestedAno) {
    query = query.eq("ano", requestedAno);
  } else {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query
    .order("ativo", { ascending: false })
    .order("ano", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    if (!requestedAno) return null;
    return {
      id: `ano-${requestedAno}`,
      ano: requestedAno,
      dataInicio: `${requestedAno}-01-01`,
      dataFim: `${requestedAno}-12-31`,
    };
  }

  const resolvedAno = normalizeYear(data.ano);
  if (!resolvedAno) return null;

  return {
    id: String(data.id),
    ano: resolvedAno,
    dataInicio: data.data_inicio ? String(data.data_inicio) : null,
    dataFim: data.data_fim ? String(data.data_fim) : null,
  };
}
