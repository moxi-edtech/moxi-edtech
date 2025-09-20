import { DashboardData } from "@/types/super-admin"
import {
  BuildingLibraryIcon,
  UsersIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline"
import { createClient } from "@/lib/supabaseClient"
import type { Database } from "~types/supabase"

type CountResult = {
  count: number
}

type Matricula = {
  id: number
  created_at: string
  // adicione outras propriedades conforme sua tabela
}

export async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const supabase = createClient()
    
    console.log('🔄 Buscando dados do dashboard...')
    
    // Tenta a RPC primeiro (caso exista no futuro)
    const { data: rpcData, error: rpcError } = await (supabase as any).rpc('dashboard')
    
    if (!rpcError && rpcData) {
      console.log('✅ Dashboard via RPC:', rpcData)
      return processRpcData(rpcData)
    }
    
    // Se RPC falhar, cria manualmente com as tabelas existentes
    console.log('📊 Criando dashboard manualmente...')
    return await createManualDashboard(supabase)
    
  } catch (error) {
    console.error('❌ Erro no fetchDashboardData:', error)
    return getEmptyDashboard()
  }
}

async function createManualDashboard(supabase: any): Promise<DashboardData> {
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

    const activities = (recentActivities as Matricula[] || []).map(matricula => 
      `Nova matrícula #${matricula.id} - ${new Date(matricula.created_at).toLocaleDateString('pt-BR')}`
    )

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

// Caso precise processar dados da RPC no futuro
function processRpcData(rpcData: any): DashboardData {
  // Implemente conforme a estrutura da sua RPC
  return getEmptyDashboard()
}