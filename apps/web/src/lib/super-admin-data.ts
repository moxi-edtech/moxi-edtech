import { DashboardData } from "@/types/super-admin"
import {
  BuildingLibraryIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline"
import { createClient } from "@/lib/supabaseClient"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const supabase = createClient()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    const escolaId = user ? await resolveEscolaIdForUser(supabase as any, user.id) : null

    if (!escolaId) {
      return getEmptyDashboard()
    }

    const [countsRes, financeiroRes] = await Promise.all([
      supabase
        .from('vw_admin_dashboard_counts')
        .select('alunos_ativos, turmas_total, professores_total')
        .eq('escola_id', escolaId)
        .maybeSingle(),
      supabase
        .from('vw_financeiro_dashboard')
        .select('total_pendente, total_pago, total_inadimplente')
        .eq('escola_id', escolaId)
        .maybeSingle(),
    ])

    const alunosCount = countsRes.data?.alunos_ativos ?? 0
    const turmasCount = countsRes.data?.turmas_total ?? 0
    const professoresCount = countsRes.data?.professores_total ?? 0

    const totalPago = Number(financeiroRes.data?.total_pago ?? 0)
    const totalPendente = Number(financeiroRes.data?.total_pendente ?? 0)
    const totalInadimplente = Number(financeiroRes.data?.total_inadimplente ?? 0)
    const totalPrevisto = totalPago + totalPendente + totalInadimplente
    const pagamentosPercent = totalPrevisto ? Math.round((totalPago / totalPrevisto) * 100) : 0

    const kpis = [
      {
        title: "Alunos",
        value: alunosCount,
        icon: BuildingLibraryIcon,
      },
      {
        title: "Turmas",
        value: turmasCount,
        icon: UsersIcon,
      },
      {
        title: "Professores",
        value: professoresCount,
        icon: ChartBarIcon,
      },
      {
        title: "Financeiro",
        value: `${pagamentosPercent}% pago`,
        icon: ShieldExclamationIcon,
      },
    ]

    return {
      kpis,
      activities: [],
      quickActions: [
        { label: "Criar Usuário", icon: UsersIcon },
        { label: "Criar Escola", icon: BuildingLibraryIcon },
        { label: "Gerir Usuários Globais", icon: Cog6ToothIcon },
        { label: "Ver Alertas de Compliance", icon: ShieldExclamationIcon },
      ],
    }
  } catch (error) {
    console.error('❌ Erro no fetchDashboardData:', error)
    return getEmptyDashboard()
  }
}

function getEmptyDashboard(): DashboardData {
  return {
    kpis: [],
    activities: [],
    quickActions: []
  }
}
