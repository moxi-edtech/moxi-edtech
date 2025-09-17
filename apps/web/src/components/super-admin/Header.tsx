// src/components/super-admin/Header.tsx
"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { useEffect, useState } from "react"

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>("")

  useEffect(() => {
    // Buscar email do usuário logado e manter em tempo real
    let mounted = true

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      setUserEmail(session?.user?.email || "")
    }

    bootstrap()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserEmail(session?.user?.email || "")
      if (event === 'SIGNED_OUT') {
        router.push('/login')
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
      router.refresh() // Força atualização do estado de autenticação
    } catch (error) {
      console.error("Erro ao fazer logout:", error)
    }
  }

  return (
    <header className="h-14 bg-white shadow flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center space-x-4">
        <h1 className="text-lg font-semibold text-gray-700">
          Portal do Super Admin
        </h1>
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
  )
}
