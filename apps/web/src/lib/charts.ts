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

  const { data: pagamentos } = escolaId
    ? await supabase
        .from("pagamentos_status")
        .select("status, total")
        .eq("escola_id", escolaId)
    : { data: [] }

  return {
    pagamentos: pagamentos ?? [],
  }
}
