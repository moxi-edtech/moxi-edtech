import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { FORMACAO_FORMADOR_NAV, FormacaoRoleShell } from '@/components/formacao/FormacaoRoleShell'
import { getFormacaoContext } from '@/lib/auth/formacaoAccess'

const ALLOWED_FORMADOR_ROLES = new Set(['formador'])

export default async function FormacaoFormadorLayout({ children }: { children: ReactNode }) {
  const context = await getFormacaoContext()
  if (!context?.role) redirect('/redirect')
  if (String(context.modeloEnsino ?? '').toLowerCase() !== 'formacao') redirect('/redirect')
  if (!ALLOWED_FORMADOR_ROLES.has(context.role)) redirect('/redirect')

  return (
    <FormacaoRoleShell title="KLASSE Formação — Formador" items={FORMACAO_FORMADOR_NAV}>
      {children}
    </FormacaoRoleShell>
  )
}
