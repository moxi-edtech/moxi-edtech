type SupabaseLike = {
  from: (table: string) => any;
};

export type OpenRematriculaWindow = {
  id: string;
  ano_letivo: number;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
};

export async function resolveOpenRematriculaWindow(
  supabase: SupabaseLike,
  escolaId: string,
  currentYear: number,
): Promise<OpenRematriculaWindow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("rematricula_janelas")
    .select("id, ano_letivo, data_inicio, data_fim, ativa")
    .eq("escola_id", escolaId)
    .eq("ativa", true)
    .gte("ano_letivo", currentYear)
    .lte("data_inicio", now)
    .gte("data_fim", now)
    .order("ano_letivo", { ascending: true })
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function resolveRematriculaWindow(
  supabase: SupabaseLike,
  escolaId: string,
  anoLetivo: number,
): Promise<{ configured: boolean; open: boolean; window: OpenRematriculaWindow | null }> {
  const { data } = await supabase
    .from("rematricula_janelas")
    .select("id, ano_letivo, data_inicio, data_fim, ativa")
    .eq("escola_id", escolaId)
    .eq("ano_letivo", anoLetivo)
    .eq("ativa", true)
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { configured: false, open: false, window: null };

  const now = Date.now();
  const open = now >= new Date(data.data_inicio).getTime() && now <= new Date(data.data_fim).getTime();
  return { configured: true, open, window: data };
}
