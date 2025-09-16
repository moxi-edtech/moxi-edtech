import { ComponentType, SVGProps } from "react"

// Tipo correto para ícones do Heroicons
export type IconType = ComponentType<SVGProps<SVGSVGElement>>

// Estrutura que o frontend consome
export interface Kpi {
  title: string
  value: string | number
  icon: IconType
}

export interface QuickAction {
  label: string
  icon: IconType
}

export interface DashboardData {
  kpis: Kpi[]
  activities: string[]
  quickActions: QuickAction[]
}

// Estrutura que vem do Supabase (função SQL dashboard)
export interface DashboardSQL {
  totais: {
    escolas: number
    alunos: number
    turmas: number
    matriculas: number
  }
  notas: Array<{
    turma: string
    disciplina: string
    media: number
  }>
  pagamentos: {
    status: Array<{
      status: string
      qtd: number
      total: number
    }>
    percentual_pago: number
  }
}
