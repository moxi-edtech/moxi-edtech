import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { BackofficeShell } from './BackofficeShell'
import { normalizePapel, type Papel } from '@/lib/permissions'
import { getFormacaoContext } from '@/lib/auth/formacaoAccess'
import { supabaseServer } from '@/lib/supabaseServer'

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

  if (!context.escolaId) redirect('/login')
  const supabase = await supabaseServer()

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
