import type { Kpi, QuickAction } from "@/components/super-admin/definitions"
import {
  BuildingLibraryIcon,
  UsersIcon,
  AcademicCapIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ShieldExclamationIcon,
  PlusIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline"

// KPIs padrão (fallback)
export const DEFAULT_KPIS: Kpi[] = [
  {
    title: "Escolas",
    value: 0,
    icon: BuildingLibraryIcon,
    trend: 'neutral',
    description: "Total de escolas cadastradas"
  },
  {
    title: "Usuários Globais",
    value: 0,
    icon: UsersIcon,
    trend: 'neutral',
    description: "Administradores e supervisores"
  },
  {
    title: "Matrículas",
    value: 0,
    icon: AcademicCapIcon,
    trend: 'neutral',
    description: "Total de matrículas ativas"
  },
  {
    title: "Financeiro",
    value: "0% pago",
    icon: BanknotesIcon,
    trend: 'neutral',
    description: "Percentual de pagamentos recebidos"
  }
]

// Ações rápidas padrão
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Criar Usuário",
    icon: UsersIcon,
    variant: 'primary',
    href: "/super-admin/users/create"
  },
  {
    label: "Criar Escola",
    icon: BuildingLibraryIcon,
    variant: 'primary',
    href: "/super-admin/schools/create"
  },
  {
    label: "Gerir Usuários Globais",
    icon: Cog6ToothIcon,
    variant: 'secondary',
    href: "/super-admin/users"
  },
  {
    label: "Ver Alertas de Compliance",
    icon: ShieldExclamationIcon,
    variant: 'secondary',
    href: "/super-admin/compliance"
  }
]

// Cores para temas
export const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#10b981', 
  red: '#ef4444',
  yellow: '#f59e0b',
  indigo: '#6366f1',
  gray: '#9ca3af',
  lightGray: '#e5e7eb'
}

// Status mappings
export const STATUS_CONFIG = {
  active: { color: 'green', label: 'Ativo' },
  inactive: { color: 'red', label: 'Inativo' },
  pending: { color: 'yellow', label: 'Pendente' },
  paid: { color: 'green', label: 'Pago' },
  cancelled: { color: 'red', label: 'Cancelado' }
} as const

// Roles com labels
export const USER_ROLES = {
  super_admin: 'Super Admin',
  global_admin: 'Admin Global',
  school_admin: 'Admin Escolar',
  teacher: 'Professor',
  student: 'Aluno'
} as const
