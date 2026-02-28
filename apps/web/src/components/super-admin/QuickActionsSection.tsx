// apps/web/src/components/super-admin/QuickActionsSection.tsx
"use client"

import {
  UsersIcon,
  BuildingLibraryIcon,
  BanknotesIcon,
  ArrowRightIcon,
  BoltIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline"
import { useRouter } from "next/navigation"

interface QuickAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'accent'
  description?: string
}

const quickActions: QuickAction[] = [
  {
    label: "Nova Escola",
    icon: BuildingLibraryIcon,
    href: "/super-admin/escolas/nova",
    variant: 'primary',
    description: "Configurar uma nova unidade no sistema",
  },
  {
    label: "Utilizadores",
    icon: UsersIcon,
    href: "/super-admin/usuarios/novo",
    variant: 'primary',
    description: "Gerir acessos da equipa central",
  },
  {
    label: "Financeiro",
    icon: BanknotesIcon,
    href: "/financeiro",
    variant: 'secondary',
    description: "Ver o fluxo de pagamentos global",
  },
  {
    label: "Modelos de Email",
    icon: EnvelopeIcon,
    href: "/super-admin/debug/email-preview",
    variant: 'accent',
    description: "Rever comunicações automáticas",
  },
  {
    label: "Dados de Teste",
    icon: BoltIcon,
    href: "/admin-seed",
    variant: 'accent',
    description: "Simular carga para testes",
  },
]

export default function QuickActionsSection() {
  const router = useRouter()

  return (
    <div className="relative rounded-[2.5rem] bg-white border border-slate-200/60 p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E3B23C]" />
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Atalhos Rápidos
            </h3>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Como podemos ajudar agora?
          </h2>
        </div>
      </div>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {quickActions.map((action) => {
          const isPrimary = action.variant === 'primary'
          const isAccent = action.variant === 'accent'
          
          return (
            <button
              key={action.label}
              onClick={() => action.href ? router.push(action.href) : action.onClick?.()}
              className="group relative flex flex-col items-start w-full rounded-[1.5rem] p-6 text-left transition-all duration-300 bg-white border border-slate-100 hover:border-slate-200 hover:shadow-[0_15px_30px_rgba(0,0,0,0.04)] hover:-translate-y-1 active:scale-[0.98] outline-none"
            >
              <div className={`mb-6 p-3 rounded-2xl transition-colors duration-300 ${
                isPrimary 
                  ? "bg-[#1F6B3B]/10 text-[#1F6B3B]" 
                  : isAccent 
                    ? "bg-[#E3B23C]/10 text-[#E3B23C]" 
                    : "bg-slate-50 text-slate-500"
              }`}>
                <action.icon className="h-6 w-6 stroke-[1.5]" />
              </div>

              <div className="relative flex-1 min-w-0 mb-6">
                <span className="block text-[13px] font-bold text-slate-900 tracking-tight mb-1.5 uppercase">
                  {action.label}
                </span>
                <p className="text-[11px] font-medium text-slate-400 leading-snug line-clamp-2">
                  {action.description}
                </p>
              </div>

              <div className="relative mt-auto w-full flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-slate-600 transition-colors">
                  Abrir
                </span>
                <ArrowRightIcon className="h-3.5 w-3.5 text-slate-300 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
