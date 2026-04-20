import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export async function shouldRouteToEscolaAdmin(client: Client, escolaId: string): Promise<boolean> {
  const [{ data: escolaRows }, { data: anoAtivoRows }] = await Promise.all([
    client
      .from("escolas")
      .select("onboarding_finalizado")
      .eq("id", escolaId)
      .limit(1),
    client
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .limit(1),
  ]);

  const onboardingDone = Boolean(escolaRows && escolaRows.length > 0 && escolaRows[0]?.onboarding_finalizado);
  const hasAnoLetivoAtivo = Array.isArray(anoAtivoRows) && anoAtivoRows.length > 0;
  return onboardingDone || hasAnoLetivoAtivo;
}

