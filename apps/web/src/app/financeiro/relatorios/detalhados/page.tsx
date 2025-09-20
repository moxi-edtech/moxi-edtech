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
        <AuditPageView portal="financeiro" action="PAGE_VIEW" entity="relatorios_detalhados" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para acessar relatórios detalhados.
        </div>
      </PortalLayout>
    )
  }
  const eid: string = escolaId
  const { data: esc } = await s.from('escolas').select('plano').eq('id', eid).maybeSingle()
  const plan = ((esc as any)?.plano || 'basico') as 'basico'|'standard'|'premium'
  const allowed = plan === 'standard' || plan === 'premium'

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" action="PAGE_VIEW" entity="relatorios_detalhados" />
      <div className="bg-white rounded-xl shadow border p-5">
        <h1 className="text-lg font-semibold mb-2">Relatórios Detalhados</h1>
        {!allowed ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
            Disponível no plano Standard ou Premium. Fale com o Super Admin para atualizar seu plano.
            {isSuperAdmin && escolaId && (
              <> {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-amber-900">Abrir edição da escola</a></>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600 space-y-2">
            <p>Em breve: Inadimplência por período, fluxo de caixa mensal, comparativos e tendência.</p>
            <p>Exportações avançadas (Excel/PDF) também serão disponibilizadas aqui.</p>
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
