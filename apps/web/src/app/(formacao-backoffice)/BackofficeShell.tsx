'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, ReactNode } from 'react'
import { BarChart3, BookOpen, LayoutDashboard, Settings, Shield, Wallet, UsersRound } from 'lucide-react'
import { hasPermission, type Papel, type Permission } from '@/lib/permissions'

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  perms: Permission[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/formacao/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, perms: ['visualizar_relatorios_globais'] },
  { href: '/formacao/cohorts', label: 'Turmas', icon: UsersRound, perms: ['gerir_cohorts'] },
  { href: '/formacao/secretaria/catalogo-cursos', label: 'Académico', icon: BookOpen, perms: ['gerir_cohorts'] },
  { href: '/formacao/financeiro/dashboard', label: 'Financeiro', icon: Wallet, perms: ['visualizar_fluxo_caixa'] },
  { href: '/formacao/admin/relatorios-kpi', label: 'Relatórios', icon: BarChart3, perms: ['visualizar_relatorios_globais'] },
  { href: '/formacao/admin/configuracoes', label: 'Configurações', icon: Settings, perms: ['configurar_escola'] },
  { href: '/formacao/admin/equipa', label: 'Utilizadores', icon: Shield, perms: ['editar_usuario'] },
]

export function BackofficeShell({
  children,
  papel,
}: {
  children: ReactNode
  papel: Papel | null
}) {
  const pathname = usePathname() ?? ''
  const allowedItems = NAV_ITEMS.filter((item) => item.perms.some((perm) => hasPermission(papel, perm)))

  return (
    <div className="min-h-screen bg-slate-100 text-sm">
      <div className="flex min-h-screen">
        <aside className="w-64 bg-slate-950 p-4">
          <div className="mb-6 px-3 text-base font-semibold text-white">KLASSE Formação</div>
          <nav className="space-y-1">
            {allowedItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                    active
                      ? 'bg-slate-900 text-klasse-gold ring-1 ring-klasse-gold/25'
                      : 'text-slate-400 hover:text-klasse-gold'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
