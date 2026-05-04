import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import AdmissoesInboxClient from "@/components/secretaria/AdmissoesInboxClient";

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
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_inbox" />
          Vincule seu perfil a uma escola para ver o inbox de admissões.
      </>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-sans">Gestão de Admissões</h1>
        <p className="text-sm text-slate-500">Acompanhe e processe novas matrículas online com foco em produtividade.</p>
      </div>

      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="admissoes_inbox" />
      <AdmissoesInboxClient escolaId={escolaId} />
    </div>
  )
}
