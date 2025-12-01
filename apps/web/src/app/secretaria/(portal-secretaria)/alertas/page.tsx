import AuditPageView from "@/components/audit/AuditPageView";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function Page() {
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  let isSuperAdmin = false
  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id, role')
      .eq('user_id', user.id)
      .maybeSingle()
    escolaId = (prof as any)?.escola_id ?? null
    isSuperAdmin = ((prof as any)?.role) === 'super_admin'
  }
  if (!escolaId) {
    return (
      <>
<AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alertas" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para configurar alertas.
        </div>
      </>
    )
  }
  const eid: string = escolaId
  let plan: 'basico'|'standard'|'premium' = 'basico'
  try {
    const res = await fetch(`/api/escolas/${eid}/nome`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    const p = (json?.plano || 'basico') as any
    if (['basico','standard','premium'].includes(p)) plan = p
  } catch {}
  const allowed = plan === 'standard' || plan === 'premium'

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="alertas" />
      <div className="bg-white rounded-xl shadow border p-5">
        <h1 className="text-lg font-semibold mb-2">Alertas (Secretaria)</h1>
        {!allowed ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
            Disponível no plano Standard ou Premium. Fale com o Super Admin para atualizar o plano da escola.
            {isSuperAdmin && escolaId && (
              <> {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-amber-900">Abrir edição da escola</a></>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Em breve: Notificações automáticas para responsáveis.</div>
        )}
      </div>
    </>
  )
}
