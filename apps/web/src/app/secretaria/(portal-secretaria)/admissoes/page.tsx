import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import AdmissoesRadarClient from "@/components/secretaria/AdmissoesRadarClient";

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
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_radar" />
          Vincule seu perfil a uma escola para ver o radar de admissões.
      </>
    )
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_radar" />
      <AdmissoesRadarClient escolaId={escolaId} />
    </>
  )
}
