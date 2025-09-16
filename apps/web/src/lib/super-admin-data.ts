import { DashboardData } from "@/types/super-admin"
import {
  BuildingLibraryIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline"
import { createClient } from "@/lib/supabaseClient"
import type { Database } from "@/types/supabase"

type Matricula = Pick<Database["public"]["Tables"]["matriculas"]["Row"], "id" | "created_at">

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const supabase = createClient()
    
    console.log('🔄 Buscando dados do dashboard...')
    // Cria manualmente com as tabelas existentes
    console.log('📊 Criando dashboard manualmente...')
    return await createManualDashboard(supabase)
    
  } catch (error) {
    console.error('❌ Erro no fetchDashboardData:', error)
    return getEmptyDashboard()
  }
}

async function createManualDashboard(supabase: ReturnType<typeof createClient>): Promise<DashboardData> {
  try {
    // Busca contagens das tabelas existentes - usando approach mais seguro
    const [
      escolasResponse, 
      alunosResponse,
      turmasResponse,
      matriculasResponse
    ] = await Promise.all([
      supabase.from('escolas').select('*', { count: 'exact', head: true }),
      supabase.from('alunos').select('*', { count: 'exact', head: true }),
      supabase.from('turmas').select('*', { count: 'exact', head: true }),
      supabase.from('matriculas').select('*', { count: 'exact', head: true })
    ])

    const escolasCount = escolasResponse.count || 0
    const alunosCount = alunosResponse.count || 0
    const turmasCount = turmasResponse.count || 0
    const matriculasCount = matriculasResponse.count || 0

    console.log('📈 Contagens encontradas:', {
      escolas: escolasCount,
      alunos: alunosCount,
      turmas: turmasCount,
      matriculas: matriculasCount
    })

    const kpis = [
      { 
        title: "Escolas", 
        value: escolasCount, 
        icon: BuildingLibraryIcon 
      },
      { 
        title: "Alunos", 
        value: alunosCount, 
        icon: UsersIcon 
      },
      { 
        title: "Turmas", 
        value: turmasCount, 
        icon: ChartBarIcon 
      },
      { 
        title: "Matrículas", 
        value: matriculasCount, 
        icon: ShieldExclamationIcon 
      },
    ]

    // Busca atividades recentes (últimas matrículas)
    const { data: recentActivities } = await supabase
      .from('matriculas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    const activities = ((recentActivities as Matricula[] | null) || []).map(m => {
      const dateLabel = m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : 'sem data'
      return `Nova matrícula #${m.id} - ${dateLabel}`
    })

    return {
      kpis,
      activities,
      quickActions: [
        { label: "Criar Usuário", icon: UsersIcon },
        { label: "Criar Escola", icon: BuildingLibraryIcon },
        { label: "Gerir Usuários Globais", icon: Cog6ToothIcon },
        { label: "Ver Alertas de Compliance", icon: ShieldExclamationIcon },
      ]
    }

  } catch (error) {
    console.error('❌ Erro ao criar dashboard manual:', error)
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

// Função reservada para futura RPC (não usada no momento)
