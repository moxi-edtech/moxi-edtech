import PortalLayout from "@/components/layout/PortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"
import { supabaseServer } from "@/lib/supabaseServer"

export default async function Page() {
  const s = await supabaseServer()
  const { data: prof } = await s.from('profiles').select('escola_id, role').order('created_at', { ascending: false }).limit(1)
  const escolaId = prof?.[0]?.escola_id as string | null
  const isSuperAdmin = ((prof?.[0] as any)?.role) === 'super_admin'
  if (!escolaId) {
    return (
      <PortalLayout>
<AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="boletos" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para gerar boletos.
        </div>
      </PortalLayout>
    )
  }
  let plan: 'basico'|'standard'|'premium' = 'basico'
  try {
    const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    const p = (json?.plano || 'basico') as any
    if (['basico','standard','premium'].includes(p)) plan = p
  } catch {}
  const allowed = plan === 'standard' || plan === 'premium'

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="boletos" />
      <div className="bg-white rounded-xl shadow border p-5">
        <h1 className="text-lg font-semibold mb-2">Gerar Boleto/Link de Pagamento</h1>
        {!allowed ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
            Disponível no plano Standard ou Premium. Fale com o Super Admin para atualizar seu plano.
            {isSuperAdmin && escolaId && (
              <>
                {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-amber-900">Abrir edição da escola</a>
              </>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Em breve: Integração bancária simples para gerar boletos e links de pagamento.
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
