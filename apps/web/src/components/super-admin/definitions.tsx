// apps/web/src/app/super-admin/lib/definitions.ts
import { IconType } from "@/types/super-admin"

// Tipos base
export interface Kpi {
  title: string
  value: string | number
  icon: IconType
  trend?: 'up' | 'down' | 'neutral'
  change?: number // porcentagem de mudança
  description?: string
}

export interface QuickAction {
  label: string
  icon: IconType
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'
}

export interface Activity {
  id: string
  type: 'user' | 'payment' | 'school' | 'enrollment' | 'grade' | 'system'
  action: string
  timestamp: Date
  user?: string
  target?: string
  metadata?: Record<string, unknown>
}

export interface DashboardData {
  kpis: Kpi[]
  activities: Activity[] // Mudamos para array de objetos em vez de strings
  quickActions: QuickAction[]
  charts?: ChartsData // Adicionando dados dos gráficos
  lastUpdated?: Date
}

// Tipos para os gráficos
export interface ChartsData {
  matriculas?: Matricula[]
  pagamentos?: Pagamento[]
  notas?: Nota[]
  usuarios?: Usuario[]
  escolas?: Escola[]
  stats?: DashboardStats
}

export interface Matricula {
  id: string
  escola_id: string
  aluno_id: string
  created_at: string
  status: 'ativa' | 'inativa' | 'pendente'
}

export interface Pagamento {
  id: string
  status: 'pago' | 'pendente' | 'cancelado' | 'estornado'
  valor: number
  data_vencimento: string
  data_pagamento?: string
  escola_id?: string
}

export interface Nota {
  id: string
  aluno_id: string
  disciplina: string
  nota: number | null
  bimestre: number
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  email: string
  role: 'super_admin' | 'global_admin' | 'school_admin' | 'teacher' | 'student'
  created_at: string
  last_login?: string
  status: 'active' | 'inactive' | 'pending'
}

export interface Escola {
  id: string
  nome: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  alunos_count?: number
  professores_count?: number
}

export interface DashboardStats {
  total_escolas: number
  total_usuarios: number
  total_alunos: number
  total_matriculas: number
  total_professores: number
  pagamentos_pendentes: number
  pagamentos_recebidos: number
  notas_lancadas: number
  notas_pendentes: number
}

// Tipos para filtros
export interface DashboardFilters {
  dateRange?: {
    start: Date
    end: Date
  }
  escolaId?: string
  status?: string
  type?: string
}

// Tipos para responses da API
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: Date
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Tipos para forms
export interface CreateUserForm {
  email: string
  role: Usuario['role']
  escola_id?: string
  nome: string
  telefone?: string
}

export interface CreateSchoolForm {
  nome: string
  cnpj?: string
  endereco: string
  telefone: string
  email: string
  diretor?: string
}

// Tipos para notificações
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: Date
  read: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

// Utility types
export type WithId<T> = T & { id: string }
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type Require<T, K extends keyof T> = T & Required<Pick<T, K>>
