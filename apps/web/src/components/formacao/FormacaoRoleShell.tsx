'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, ReactNode } from 'react'
import { BookOpen, LayoutDashboard, Shield, Wallet } from 'lucide-react'

type RoleNavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

type FormacaoRoleShellProps = {
  title: string
  items: RoleNavItem[]
  children: ReactNode
}

export function FormacaoRoleShell({ title, items, children }: FormacaoRoleShellProps) {
  const pathname = usePathname() ?? ''

  return (
    <div className="min-h-screen bg-slate-100 text-sm">
      <div className="flex min-h-screen">
        <aside className="w-64 bg-slate-950 p-4">
          <div className="mb-6 px-3 text-base font-semibold text-white">{title}</div>
          <nav className="space-y-1">
            {items.map((item) => {
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

export const FORMACAO_FORMADOR_NAV: RoleNavItem[] = [
  { href: '/formacao/honorarios/pendente', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/formacao/honorarios/extrato', label: 'Financeiro', icon: Wallet },
  { href: '/formacao/honorarios/recibos', label: 'Académico', icon: BookOpen },
]

export const FORMACAO_FORMANDO_NAV: RoleNavItem[] = [
  { href: '/formacao/conquistas/badges', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/formacao/conquistas/perfil-publico', label: 'Utilizador', icon: Shield },
]
