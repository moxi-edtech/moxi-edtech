import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type FormacaoContext = {
  role: string | null
  modeloEnsino: string | null
  escolaId: string | null
}

export async function getFormacaoContext(): Promise<FormacaoContext | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // read-only on server components
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>

  return {
    role: (appMetadata.role ?? userMetadata.role ?? null) as string | null,
    modeloEnsino: (appMetadata.modelo_ensino ?? userMetadata.modelo_ensino ?? null) as string | null,
    escolaId: (appMetadata.escola_id ?? userMetadata.escola_id ?? null) as string | null,
  }
}
