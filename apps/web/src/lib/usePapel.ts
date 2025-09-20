"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

export function usePapel(escolaId: string | null | undefined) {
  const [papel, setPapel] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function run() {
      setLoading(true); setError(null)
      try {
        if (!escolaId) { setPapel(null); return }
        const s = createClient()
        const { data: u } = await s.auth.getUser()
        const userId = u?.user?.id
        if (!userId) { setPapel(null); return }
        const { data, error } = await s
          .from('escola_usuarios')
          .select('papel')
          .eq('user_id', userId)
          .eq('escola_id', escolaId)
          .limit(1)
        if (!mounted) return
        if (error) { setError(error.message || 'Erro'); setPapel(null) }
        else setPapel((data?.[0] as any)?.papel ?? null)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message || 'Erro inesperado'); setPapel(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [escolaId])

  return { papel, loading, error }
}

