import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import AdmissaoWizardClient from "@/components/secretaria/AdmissaoWizardClient";

export const dynamic = 'force-dynamic'

export default async function Page() {
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle()
    escolaId = (prof as any)?.escola_id ?? null
  }

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissao_wizard" />
          Vincule seu perfil a uma escola para iniciar uma nova admissão.
      </>
    )
  }

  return (
    <div className="p-6">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_wizard" />
      <AdmissaoWizardClient escolaId={escolaId} />
    </div>
  )
}
