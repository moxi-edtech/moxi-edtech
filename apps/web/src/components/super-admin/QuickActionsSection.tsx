// apps/web/src/components/super-admin/QuickActionsSection.tsx
"use client"

import {
  UsersIcon,
  BuildingLibraryIcon,
  AcademicCapIcon,
  BanknotesIcon,
  ShieldExclamationIcon,
  Cog6ToothIcon,
  ArrowTopRightOnSquareIcon,
  BoltIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { useRouter } from "next/navigation"

interface QuickAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'accent'
  description?: string
}

const quickActions: QuickAction[] = [
  { 
    label: "Criar Usuário", 
    icon: UsersIcon, 
    href: "/super-admin/usuarios/novo",
    variant: 'primary',
    description: "Adicionar novo usuário global"
  },
  { 
    label: "Nova Escola", 
    icon: BuildingLibraryIcon, 
    href: "/super-admin/escolas/nova",
    variant: 'primary',
    description: "Cadastrar nova escola no sistema"
  },
  { 
    label: "Gerenciar Matrículas", 
    icon: AcademicCapIcon, 
    href: "/super-admin/matriculas",
    variant: 'secondary',
    description: "Visualizar e gerenciar matrículas"
  },
  { 
    label: "Financeiro", 
    icon: BanknotesIcon, 
    href: "/financeiro", 
    variant: 'secondary',
    description: "Acessar painel financeiro"
  },
  { 
    label: "Configurações", 
    icon: Cog6ToothIcon, 
    href: "/super-admin/configuracoes",
    variant: 'secondary',
    description: "Configurações do sistema"
  },
  { 
    label: "Alertas do Sistema", 
    icon: ShieldExclamationIcon, 
    href: "/super-admin/alertas",
    variant: 'danger',
    description: "Ver alertas e notificações"
  },
  { 
    label: "Seed Data", 
    icon: BoltIcon, 
    href: "/admin-seed",
    variant: 'accent',
    description: "Gerar dados de teste"
  },
  { 
    label: "Preview Email", 
    icon: EnvelopeIcon, 
    href: "/super-admin/debug/email-preview",
    variant: 'accent',
    description: "Pré-visualizar e-mail de onboarding"
  },
]

export default function QuickActionsSection() {
  const router = useRouter()

  const handleActionClick = (action: QuickAction) => {
    if (action.href) {
      router.push(action.href)
    } else if (action.onClick) {
      action.onClick()
    }
  }

  const getVariantStyles = (variant: QuickAction['variant'] = 'secondary') => {
    const baseStyles = "flex flex-col items-start w-full rounded-xl p-4 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 h-full"
    
    switch (variant) {
      case 'primary':
        return `${baseStyles} bg-gradient-to-r from-teal-500 to-sky-600 text-white hover:from-teal-600 hover:to-sky-700 focus:ring-teal-500 shadow-md`
      case 'danger':
        return `${baseStyles} bg-gradient-to-r from-red-100 to-red-50 text-red-700 hover:from-red-200 hover:to-red-100 border border-red-200 focus:ring-red-400 shadow-sm`
      case 'accent':
        return `${baseStyles} bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 hover:from-amber-200 hover:to-amber-100 border border-amber-200 focus:ring-amber-400 shadow-sm`
      default:
        return `${baseStyles} bg-white text-moxinexa-dark hover:bg-moxinexa-light/20 border border-moxinexa-light/30 focus:ring-moxinexa-teal/30 shadow-sm`
    }
  }

  const getIconStyles = (variant: QuickAction['variant'] = 'secondary') => {
    switch (variant) {
      case 'primary':
        return "text-white"
      case 'danger':
        return "text-red-600"
      case 'accent':
        return "text-amber-600"
      default:
        return "text-moxinexa-teal"
    }
  }

  return (
    <div className="rounded-2xl border border-moxinexa-light/30 bg-white p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <div>
          <h3 className="text-lg font-semibold text-moxinexa-dark">
            Ações Rápidas
          </h3>
          <p className="text-sm text-moxinexa-gray mt-1">
            Acesse rapidamente as funcionalidades principais
          </p>
        </div>
        <span className="text-xs font-medium text-moxinexa-teal bg-moxinexa-teal/10 px-3 py-1 rounded-full self-start sm:self-auto">
          {quickActions.length} ações
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={() => handleActionClick(action)}
            className={getVariantStyles(action.variant)}
            title={action.description}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-lg ${action.variant === 'primary' ? 'bg-white/20' : 'bg-moxinexa-light/20'}`}>
                <action.icon className={`h-5 w-5 ${getIconStyles(action.variant)}`} />
              </div>
              {action.href && (
                <ArrowTopRightOnSquareIcon className="h-4 w-4 opacity-60 ml-auto flex-shrink-0" />
              )}
            </div>
            
            <div className="text-left w-full">
              <span className="block font-medium mb-1">{action.label}</span>
              {action.description && (
                <span className="block text-xs opacity-70 line-clamp-2">
                  {action.description}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer com estatísticas */}
      <div className="mt-6 pt-4 border-t border-moxinexa-light/20">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-moxinexa-gray text-center">
          <span>Atalhos frequentes</span>
          <span className="hidden sm:inline">•</span>
          <span>Acesso prioritário</span>
          <span className="hidden sm:inline">•</span>
          <span>Super Admin</span>
        </div>
      </div>
    </div>
  )
}
