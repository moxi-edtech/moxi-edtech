// apps/web/src/app/lib/dashboard.ts
import { supabaseServer } from "@/lib/supabaseServer"

export async function getDashboardData() {
  const supabase = await supabaseServer()

  const [
    { count: totalEscolas },
    { count: totalUsuarios },
    { count: totalMatriculas },
    { count: notasLancadas },
    { count: totalNotas },
    { count: pagamentosPagos },
    { count: totalPagamentos },
  ] = await Promise.all([
    supabase.from("escolas").select("*", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["super_admin", "global_admin"]),
    supabase.from("matriculas").select("*", { count: "exact", head: true }),
    supabase.from("notas").select("*", { count: "exact", head: true }).not("nota", "is", null),
    supabase.from("notas").select("*", { count: "exact", head: true }),
    supabase.from("pagamentos").select("*", { count: "exact", head: true }).eq("status", "pago"),
    supabase.from("pagamentos").select("*", { count: "exact", head: true }),
  ])

  return {
    escolas: totalEscolas ?? 0,
    usuarios: totalUsuarios ?? 0,
    matriculas: totalMatriculas ?? 0,
    notasPercent: totalNotas ? ((notasLancadas ?? 0) / totalNotas) * 100 : 0,
    pagamentosPercent: totalPagamentos ? ((pagamentosPagos ?? 0) / totalPagamentos) * 100 : 0,
  }
}
