// apps/web/src/lib/super-admin/escola-saude.ts
import { supabaseServer } from "@/lib/supabaseServer"
import { calcularSaudeEscola } from "./escola-saude-utils";
export * from "./escola-saude-utils";

export async function getGlobalHealthSummary() {
  const supabase = await supabaseServer()
  
  // RPC que já existe no banco para métricas de saúde
  const { data: metrics, error } = await (supabase as any).rpc("admin_get_escola_health_metrics")
  
  if (error || !metrics) {
    console.error("Erro ao buscar métricas de saúde:", error)
    return { escolasEmRisco: 0, scoreMedio: 100 }
  }

  const escolas = metrics as any[]
  
  // Lógica de "Risco" e Cálculo de Score Real Individual
  const cincoDiasAtras = new Date()
  cincoDiasAtras.setDate(cincoDiasAtras.getDate() - 5)
  
  let somaScores = 0
  let escolasEmRisco = 0

  escolas.forEach(e => {
    // 1. Verifica risco (inatividade)
    const inativo = !e.ultimo_acesso || new Date(e.ultimo_acesso) < cincoDiasAtras
    if (inativo) escolasEmRisco++

    // 2. Calcula score real usando a utilidade (que penaliza falta de dados e inatividade)
    somaScores += calcularSaudeEscola(e)
  })

  const scoreMedio = escolas.length > 0 
    ? Math.round(somaScores / escolas.length)
    : 100

  return { 
    escolasEmRisco, 
    scoreMedio 
  }
}

export async function getGlobalActivities() {
  const supabase = await supabaseServer()
  
  // Busca logs de auditoria relevantes, ignorando PAGE_VIEW para não poluir
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, action, entity, escola_id, escolas(nome)")
    .neq("action", "PAGE_VIEW")
    .order("created_at", { ascending: false })
    .limit(8)

  if (error) {
    console.error("Erro ao buscar logs de actividade:", error)
    return []
  }

  return (logs || []).map((l: any) => ({
    id: l.id,
    titulo: l.escolas?.nome || "Sistema Central",
    resumo: `${l.action} em ${l.entity}`,
    data: l.created_at
  }))
}
