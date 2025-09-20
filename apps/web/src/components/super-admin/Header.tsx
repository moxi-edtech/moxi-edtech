"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"
import ConfigHealthBanner from "@/components/system/ConfigHealthBanner"
import BackButton from "@/components/navigation/BackButton"

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>("")
  const [ctxEscola, setCtxEscola] = useState<{ id: string; nome: string | null; plano: 'basico'|'standard'|'premium'|null } | null>(null)

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
            .select('nome, plano')
            .eq('id', escolaId)
            .maybeSingle()
          const plano = ((data as any)?.plano || null) as any
          setCtxEscola({
            id: escolaId,
            nome: (data as any)?.nome ?? null,
            plano: plano && ['basico','standard','premium'].includes(plano) ? plano : null
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
                  Plano: {ctxEscola.plano}
                </span>
              )}
              <a
                href={`/super-admin/escolas/${ctxEscola.id}/edit`}
                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                title="Editar escola"
              >
                Editar Escola
              </a>
            </>
          )}
          {process.env.NODE_ENV !== "production" && (
            <a
              href="/super-admin/debug"
              className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200"
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
          className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-2"
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
