// apps/web/src/app/lib/charts.ts
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"

export type ChartsData = {
  pagamentos: Array<{ status?: string | null; total?: number | null }>
}

export async function getChartsData(): Promise<ChartsData> {
  const supabase = await supabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null

  const { data: pagamentos, error } = escolaId
    ? await supabase
        .from("vw_pagamentos_status")
        .select("status, total")
        .eq("escola_id", escolaId)
    : { data: [], error: null };

  if (error) {
    console.error("Error fetching pagamentos chart data:", error);
    return { pagamentos: [] };
  }

  return {
    pagamentos: pagamentos ?? [],
  }
}
