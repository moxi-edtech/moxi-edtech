import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { BackofficeShell } from './BackofficeShell'
import { normalizePapel, type Papel } from '@/lib/permissions'
import { getFormacaoContext } from '@/lib/auth/formacaoAccess'

const ALLOWED_BACKOFFICE_ROLES = new Set([
  'formacao_admin',
  'formacao_secretaria',
  'formacao_financeiro',
])

export default async function FormacaoBackofficeLayout({ children }: { children: ReactNode }) {
  const context = await getFormacaoContext()
  if (!context?.role) redirect('/login')
  if (String(context.modeloEnsino ?? '').toLowerCase() !== 'formacao') redirect('/login')
  if (!ALLOWED_BACKOFFICE_ROLES.has(context.role)) redirect('/login')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !context.escolaId) redirect('/login')

  const cookieStore = await cookies()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // no-op (server component)
      },
    },
  })

  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) redirect('/login')

  const { data: vinculo } = await supabase
    .from('escola_users')
    .select('papel, role')
    .eq('user_id', user.id)
    .eq('escola_id', context.escolaId)
    .limit(1)
    .maybeSingle()

  const papel = normalizePapel((vinculo?.papel ?? vinculo?.role ?? context.role) as string) as Papel | null

  return <BackofficeShell papel={papel}>{children}</BackofficeShell>
}
