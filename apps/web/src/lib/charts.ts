// apps/web/src/lib/charts.ts
import { supabaseServer } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"

export type ChartsData = {
  pagamentos: Array<{ status?: string | null; total?: number | null }>
  eficiencia?: number
}

export async function getChartsData(): Promise<ChartsData> {
  const supabase = await supabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  
  // Try to resolve escolaId
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null

  // Use type casting to bypass TS issues if the table/view name is not in the generated types
  let query = (supabase.from("vw_pagamentos_status") as any).select("status, total")
  
  if (escolaId) {
    query = query.eq("escola_id", escolaId)
  }

  const { data: pagamentos, error } = await query

  if (error) {
    console.error("Error fetching pagamentos chart data:", error);
    return { pagamentos: [], eficiencia: 0 };
  }

  const items = (pagamentos as any[]) ?? []
  
  // Cálculo real da eficiência: (Pagos / Total)
  const totalGeral = items.reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  const totalPago = items
    .filter(i => i.status === 'pago')
    .reduce((acc, curr) => acc + Number(curr.total || 0), 0)
  
  const eficienciaReal = totalGeral > 0 ? Math.round((totalPago / totalGeral) * 1000) / 10 : 0

  // If no escolaId, we need to group by status and sum totals (aggregate)
  if (!escolaId && items.length > 0) {
    const aggregated = items.reduce((acc: any, curr: any) => {
      acc[curr.status] = (acc[curr.status] || 0) + Number(curr.total || 0)
      return acc
    }, {})
    
    return {
      pagamentos: Object.entries(aggregated).map(([status, total]) => ({
        status,
        total: total as number
      })),
      eficiencia: eficienciaReal
    }
  }

  return {
    pagamentos: items,
    eficiencia: eficienciaReal
  }
}

export async function getDashboardData() {
  const supabase = await supabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null

  // Se for super-admin (sem escolaId), buscamos globais
  if (!escolaId) {
    const [escolasRes, usuariosRes, countsRes, financeiroRes] = await Promise.all([
      supabase.from("escolas").select("id", { count: "exact", head: true }).eq("status", "ativa"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      (supabase.from("vw_admin_dashboard_counts") as any).select("alunos_ativos"),
      (supabase.from("vw_financeiro_dashboard") as any).select("total_pendente, total_pago, total_inadimplente")
    ])

    const totalAlunos = (countsRes.data as any[])?.reduce((acc, curr) => acc + (curr.alunos_ativos ?? 0), 0) ?? 0
    
    let totalPago = 0, totalPendente = 0, totalInadimplente = 0;
    (financeiroRes.data as any[])?.forEach((r: any) => {
      totalPago += Number(r.total_pago ?? 0)
      totalPendente += Number(r.total_pendente ?? 0)
      totalInadimplente += Number(r.total_inadimplente ?? 0)
    })

    const totalPrevisto = totalPago + totalPendente + totalInadimplente
    const pagamentosPercent = totalPrevisto ? Math.round((totalPago / totalPrevisto) * 100) : 0

    return {
      escolas: escolasRes.count ?? 0,
      usuarios: usuariosRes.count ?? 0,
      matriculas: totalAlunos,
      financeiro: pagamentosPercent
    }
  }

  // Lógica original para escola específica (se necessário no futuro por este import)
  let countsQuery = (supabase.from("vw_admin_dashboard_counts") as any).select("alunos_ativos, turmas_total, professores_total").eq("escola_id", escolaId).maybeSingle()
  let financeiroQuery = (supabase.from("vw_financeiro_dashboard") as any).select("total_pendente, total_pago, total_inadimplente").eq("escola_id", escolaId).maybeSingle()

  const [c, f] = await Promise.all([countsQuery, financeiroQuery])
  
  const tp = Number(f.data?.total_pago ?? 0)
  const tpre = tp + Number(f.data?.total_pendente ?? 0) + Number(f.data?.total_inadimplente ?? 0)

  return {
    escolas: 1,
    usuarios: 0, // Individual não conta usuários globais
    matriculas: c.data?.alunos_ativos ?? 0,
    financeiro: tpre ? Math.round((tp / tpre) * 100) : 0
  }
}
