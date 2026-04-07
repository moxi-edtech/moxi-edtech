import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { getFormacaoContext } from '@/lib/auth/formacaoAccess'

const ALLOWED_FORMANDO_ROLES = new Set(['formando'])

export default async function FormacaoFormandoLayout({ children }: { children: ReactNode }) {
  const context = await getFormacaoContext()
  if (!context?.role) redirect('/login')
  if (String(context.modeloEnsino ?? '').toLowerCase() !== 'formacao') redirect('/login')
  if (!ALLOWED_FORMANDO_ROLES.has(context.role)) redirect('/login')

  return <div className="min-h-screen bg-slate-100 text-sm">{children}</div>
}
