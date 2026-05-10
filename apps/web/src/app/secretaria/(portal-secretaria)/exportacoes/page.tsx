import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { parsePlanTier, PLAN_NAMES, type PlanTier } from "@/config/plans";

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
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="exportacoes" />
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
          Vincule seu perfil a uma escola para acessar exportações.
        </div>
      </>
    )
  }
  const eid: string = escolaId
  let plan: PlanTier = 'essencial'
  try {
    const res = await fetch(`/api/secretaria/dashboard/summary`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    plan = parsePlanTier(json?.escola?.plano)
  } catch {}
  const allowed = plan === 'profissional' || plan === 'premium'

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="exportacoes" />
      <div className="bg-white rounded-xl shadow border p-5">
        <DashboardHeader
          title="Exportações (Secretaria)"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Exportações" },
          ]}
        />
        {!allowed ? (
          <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
            Disponível no plano {PLAN_NAMES.profissional} ou {PLAN_NAMES.premium}. Fale com o Super Admin para atualizar o plano da escola.
            {isSuperAdmin && escolaId && (
              <> {' '}<a href={`/super-admin/escolas/${escolaId}/edit`} className="underline text-klasse-gold-900">Abrir edição da escola</a></>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-600">Em breve: Exportação avançada em Excel/PDF.</div>
        )}
      </div>
    </>
  )
}
