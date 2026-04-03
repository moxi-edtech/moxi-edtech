"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import ConfigHealthBanner from "@/components/system/ConfigHealthBanner"
import BackButton from "@/components/navigation/BackButton"
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans"

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>("")
  const [ctxEscola, setCtxEscola] = useState<{ id: string; nome: string | null; plano: PlanTier | null } | null>(null)

  useEffect(() => {
    let mounted = true

    // 🔑 busca usuário validado no servidor
    const bootstrap = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!mounted) return
      if (error || !user) {
        setUserEmail("")
      } else {
        setUserEmail(user.email || "")
      }
    }

    bootstrap()

    // Detecta contexto de escola na URL e busca plano/nome
    const detect = async () => {
      try {
        if (typeof window === 'undefined') return
        const path = window.location.pathname
        const m = path.match(/\/super-admin\/escolas\/([^\/]+)/)
        if (m && m[1]) {
          const escolaId = m[1]
          const { data } = await supabase
            .from('escolas')
            .select('nome, plano_atual, plano')
            .eq('id', escolaId)
            .maybeSingle()
          const planoRaw = (data as any)?.plano_atual ?? (data as any)?.plano ?? null
          const plano = planoRaw ? parsePlanTier(planoRaw) : null
          setCtxEscola({
            id: escolaId,
            nome: (data as any)?.nome ?? null,
            plano,
          })
        } else {
          setCtxEscola(null)
        }
      } catch {
        setCtxEscola(null)
      }
    }

    detect()

    // 🔄 escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || "")

      if (event === "SIGNED_OUT") {
        router.push("/login")
        router.refresh()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  return (
    <>
      <header className="h-14 bg-white shadow flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <Link href="/super-admin" className="flex items-center gap-2" aria-label="Ir para a home do Super Admin">
            <div className="h-8 w-8 rounded-lg bg-klasse-gold-500/15 ring-1 ring-klasse-gold-500/30 flex items-center justify-center">
              <Image src="/logo-klasse-ui.png" alt="KLASSE" width={16} height={16} className="h-4 w-4 object-contain" />
            </div>
          </Link>
          <div className="hidden sm:block">
            <BackButton />
          </div>
          <h1 className="text-lg font-semibold text-gray-700">
            Portal do Super Admin
          </h1>
          {ctxEscola && (
            <>
              <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">
                {ctxEscola.nome ? ctxEscola.nome : `Escola ${ctxEscola.id}`}
              </span>
              {ctxEscola.plano && (
                <span className="text-[10px] uppercase px-2 py-1 rounded-full bg-gray-100 border text-gray-600">
                  Plano: {PLAN_NAMES[ctxEscola.plano]}
                </span>
              )}
              <a
                href={`/super-admin/escolas/${ctxEscola.id}/edit`}
                className="text-xs px-2 py-1 rounded bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                title="Editar escola"
              >
                Editar Escola
              </a>
            </>
          )}
          {process.env.NODE_ENV !== "production" && (
            <a
              href="/super-admin/debug"
              className="text-xs px-2 py-1 rounded bg-klasse-green-100 text-klasse-green-700 border border-klasse-green-200 hover:bg-klasse-green-200"
              title="Página de debug (apenas desenvolvimento)"
            >
              Debug
            </a>
          )}
          {userEmail && (
            <span className="text-sm text-gray-500 hidden md:block">
              ({userEmail})
            </span>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors flex items-center space-x-2"
        >
          <span>Sair</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>
      <ConfigHealthBanner />
    </>
  )
}
