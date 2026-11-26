'use client'

import Link from 'next/link'
import { SIDEBAR_WIDTH, SIDEBAR_LABEL, SIDEBAR_NAV, SIDEBAR_ROW, sidebarLabel } from '@/lib/sidebarPresentation'
import Image from 'next/image'
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
  const shortTitle = title.replace('KLASSE Formação — ', '')
  const isFormador = shortTitle.toLowerCase().includes('formador')
  const rolePillClass = isFormador
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-sky-200 bg-sky-50 text-sky-700'

  return (
    <div className="min-h-screen bg-slate-100 text-sm">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur md:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-amber/30 bg-amber/15">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={16} height={16} className="h-4 w-4 object-contain" />
            </span>
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Portal Formação</p>
              <p className="m-0 truncate text-sm font-semibold text-slate-900">{shortTitle}</p>
            </div>
          </div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${rolePillClass}`}>
            {isFormador ? 'Formador' : 'Formando'}
          </span>
        </div>
      </header>

      <div className="flex min-h-screen">
        <aside className="klasse-sidebar-theme sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden bg-sidebar p-2 md:flex" style={{ width: SIDEBAR_WIDTH.expanded }}>
          <div className="mb-4 shrink-0 truncate px-3 py-3 text-base font-semibold text-white" title={title}>{title}</div>
          <nav className={`${SIDEBAR_NAV} space-y-1 p-1`}>
            {items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`${SIDEBAR_ROW} ${
                    active
                      ? 'bg-sidebar-accent text-klasse-gold ring-1 ring-klasse-gold/25'
                      : 'text-sidebar-muted-foreground hover:text-klasse-gold'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className={SIDEBAR_LABEL}>{sidebarLabel(item.label)}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 pb-28 md:p-6 md:pb-6">{children}</main>
      </div>

      <nav
        className="fixed bottom-3 left-1/2 z-40 grid w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 ${
                active
                  ? 'bg-amber/20 text-slate-900 ring-1 ring-amber/30'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
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
