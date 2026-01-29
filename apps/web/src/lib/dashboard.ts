// apps/web/src/app/lib/dashboard.ts
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"

export async function getDashboardData() {
  const supabase = await supabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null

  const [countsRes, financeiroRes] = escolaId
    ? await Promise.all([
        supabase
          .from("vw_admin_dashboard_counts")
          .select("alunos_ativos, turmas_total, professores_total")
          .eq("escola_id", escolaId)
          .maybeSingle(),
        supabase
          .from("vw_financeiro_dashboard")
          .select("total_pendente, total_pago, total_inadimplente")
          .eq("escola_id", escolaId)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }]

  const alunos = countsRes.data?.alunos_ativos ?? 0
  const turmas = countsRes.data?.turmas_total ?? 0
  const professores = countsRes.data?.professores_total ?? 0

  const totalPago = Number(financeiroRes.data?.total_pago ?? 0)
  const totalPendente = Number(financeiroRes.data?.total_pendente ?? 0)
  const totalInadimplente = Number(financeiroRes.data?.total_inadimplente ?? 0)
  const totalPrevisto = totalPago + totalPendente + totalInadimplente
  const pagamentosPercent = totalPrevisto ? (totalPago / totalPrevisto) * 100 : 0

  return {
    alunos,
    turmas,
    professores,
    pagamentosPercent,
  }
}
