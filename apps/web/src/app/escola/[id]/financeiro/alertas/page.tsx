import PortalLayout from "@/components/layout/PortalLayout"
import AuditPageView from "@/components/audit/AuditPageView"
import { supabaseServer } from "@/lib/supabaseServer"
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"

export default async function Page() {
  const s = await supabaseServer()
  const { data: userRes } = await s.auth.getUser()
  const user = userRes?.user
  const metaEscolaId = (user?.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
  const { data: profile } = user
    ? await s.from('profiles').select('escola_id, role').eq('user_id', user.id).maybeSingle()
    : { data: null }
  const escolaId = user
    ? await resolveEscolaIdForUser(
        s,
        user.id,
        profile?.escola_id ?? null,
        metaEscolaId ? String(metaEscolaId) : null
      )
    : null
  const isSuperAdmin = profile?.role === 'super_admin'
  if (!escolaId) {
    return (
      <PortalLayout>
<AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="alertas" />
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          Vincule seu perfil a uma escola para configurar alertas.
        </div>
      </PortalLayout>
    )
  }
  let plan: PlanTier = 'essencial'
  try {
    const res = await fetch(`/api/escolas/${escolaId}/nome`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    plan = parsePlanTier(json?.plano)
  } catch {}
  const allowed = plan === 'profissional' || plan === 'premium'

  return (
    <PortalLayout>
      <AuditPageView portal="financeiro" acao="PAGE_VIEW" entity="alertas" />
      <div className="bg-white rounded-xl shadow border p-5">
        <h1 className="text-lg font-semibold mb-2">Alertas Automáticos</h1>
        {!allowed ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
            Disponível no plano {PLAN_NAMES.profissional} ou {PLAN_NAMES.premium}. Fale com o Super Admin para atualizar seu plano.
            {isSuperAdmin && escolaId && (
              <> {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-amber-900">Abrir edição da escola</a></>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Em breve: Configuração de lembretes por e-mail/WhatsApp para inadimplentes.
          </div>
        )}
      </div>
    </PortalLayout>
  )
}
