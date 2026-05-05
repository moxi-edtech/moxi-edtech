import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { FORMACAO_FORMANDO_NAV, FormacaoRoleShell } from '@/components/formacao/FormacaoRoleShell'
import { getFormacaoContext } from '@/lib/auth/formacaoAccess'

const ALLOWED_FORMANDO_ROLES = new Set(['formando'])

export default async function FormacaoFormandoLayout({ children }: { children: ReactNode }) {
  const context = await getFormacaoContext()
  if (!context?.role) redirect('/redirect')
  if (String(context.modeloEnsino ?? '').toLowerCase() !== 'formacao') redirect('/redirect')
  if (!ALLOWED_FORMANDO_ROLES.has(context.role)) redirect('/redirect')

  return (
    <FormacaoRoleShell title="KLASSE Formação — Formando" items={FORMACAO_FORMANDO_NAV}>
      {children}
    </FormacaoRoleShell>
  )
}
