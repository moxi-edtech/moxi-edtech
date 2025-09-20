"use client"

import { useEffect, useState } from "react"

type Health = {
  ok: boolean
  env?: {
    hasUrl?: boolean
    hasAnonKey?: boolean
    hasServiceKey?: boolean
    mode?: string
  }
}

export default function ConfigHealthBanner() {
  const [missing, setMissing] = useState<string[]>([])
  const [hidden, setHidden] = useState<boolean>(false)

  useEffect(() => {
    try {
      const dismissed = typeof window !== 'undefined' && window.localStorage.getItem('hideConfigHealthBanner')
      if (dismissed) setHidden(true)
    } catch {}
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        const json: Health = await res.json()
        if (!active) return
        const miss: string[] = []
        if (!json?.env?.hasUrl) miss.push('NEXT_PUBLIC_SUPABASE_URL')
        if (!json?.env?.hasAnonKey) miss.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
        if (!json?.env?.hasServiceKey) miss.push('SUPABASE_SERVICE_ROLE_KEY')
        setMissing(miss)
      } catch {
        // If health route fails, surface generic warning
        setMissing(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'])
      }
    }
    run()
    return () => { active = false }
  }, [])

  if (hidden) return null
  if (missing.length === 0) return null

  const onClose = () => {
    setHidden(true)
    try { window.localStorage.setItem('hideConfigHealthBanner', '1') } catch {}
  }

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 border border-amber-300 text-[10px] mt-0.5">!</span>
        <div className="flex-1">
          <strong>Configuração incompleta:</strong> defina as variáveis de ambiente ausentes para que as APIs funcionem corretamente.
          <div className="mt-1">
            Faltando: {missing.join(', ')}
          </div>
          <div className="mt-1 text-[12px] text-amber-800">
            Edite seu arquivo .env.local e reinicie o servidor de desenvolvimento.
          </div>
        </div>
        <button onClick={onClose} className="text-amber-800 hover:text-amber-900 px-2">Fechar</button>
      </div>
    </div>
  )
}

