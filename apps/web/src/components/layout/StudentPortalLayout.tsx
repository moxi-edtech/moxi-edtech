"use client"

import { useEffect, useState } from 'react'
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from '@/lib/supabaseClient'
import SidebarContainer from "@/components/layout/shared/SidebarContainer";
import {
  HomeIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  LifebuoyIcon,
  Bars3Icon,
  BellIcon,
} from '@heroicons/react/24/outline'
import SignOutButton from '@/components/auth/SignOutButton'
import BackButton from '@/components/navigation/BackButton'
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans"
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser'
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

type Item = { name: string, icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }

const items: Item[] = [
  { name: 'Dashboard', icon: HomeIcon },
  { name: 'Cursos', icon: AcademicCapIcon },
  { name: 'Notas', icon: ClipboardDocumentListIcon },
  { name: 'Financeiro', icon: BanknotesIcon },
  { name: 'Suporte', icon: LifebuoyIcon },
]

export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState('Dashboard')
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<PlanTier | null>(null)
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const dashboardHref = buildPortalHref(escolaParam, "/aluno/dashboard");

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    ;(async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes?.user
        if (!user) return
        const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
        const escolaId = await resolveEscolaIdForUser(
          supabase,
          user.id,
          null,
          metaEscolaId ? String(metaEscolaId) : null
        )
        if (!mounted || !escolaId) return
        try {
          const res = await fetch(`/api/escolas/${escolaId}/nome`)
          const json = await res.json().catch(() => null)
          const p = json?.plano ?? null
          if (mounted && p) setPlan(parsePlanTier(p))
        } catch {}
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-moxinexa-light/20 to-white text-moxinexa-dark">
      {/* Sidebar */}
      <SidebarContainer
        storageKey="aluno:portal:sidebar"
        cssVar="--sidebar-w"
        className={`bg-white md:rounded-r-2xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <Link href={dashboardHref} className="flex items-center gap-3" aria-label="Ir para a home do aluno">
            <div className="h-10 w-10 rounded-xl bg-klasse-gold-500/15 ring-1 ring-klasse-gold-500/30 flex items-center justify-center shadow-lg">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={20} height={20} className="h-5 w-5 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">KLASSE</h1>
              <p className="text-xs text-moxinexa-light opacity-70">Portal do Aluno</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="md:hidden p-2 rounded-lg bg-moxinexa-light/30">✕</button>
        </div>
        <nav className="px-3 py-3 space-y-1">
          {items.map(({ name, icon: Icon }) => (
            <button key={name} onClick={() => { setActive(name); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${active === name ? 'bg-moxinexa-teal/10 text-moxinexa-teal' : 'hover:bg-moxinexa-light/40 text-moxinexa-gray'}`}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{name}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-moxinexa-light/30 mt-4">
        <div className="px-4 py-3 text-center text-xs text-slate-400">© 2025 KLASSE</div>
        </div>
      </SidebarContainer>

      {/* Main */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg bg-moxinexa-light/30" onClick={() => setOpen(true)}><Bars3Icon className="w-5 h-5" /></button>
            <h1 className="text-xl font-semibold">{active}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full bg-moxinexa-light/30"><BellIcon className="w-5 h-5" /></button>
            <SignOutButton label="Sair" className="px-3 py-1.5 text-xs bg-slate-500 text-white rounded-md" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-moxinexa-light/30">
          <div className="mb-3">
            <BackButton />
          </div>
          {children}
        </div>
        <footer className="mt-8 text-center text-sm text-slate-400">Bons estudos! 🎓</footer>
      </main>
    </div>
  )
}
