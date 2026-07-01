import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

export async function shouldRouteToEscolaAdmin(client: Client, escolaId: string): Promise<boolean> {
  const { data: escolaRows } = await client
    .from("escolas")
    .select("onboarding_finalizado, needs_academic_setup")
    .eq("id", escolaId)
    .limit(1);

  const escola = Array.isArray(escolaRows) ? escolaRows[0] : escolaRows;
  if (!escola) return false;

  return Boolean(escola.onboarding_finalizado) || escola.needs_academic_setup === false;
}
