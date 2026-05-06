import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import AdmissaoWizardClient from "@/components/secretaria/AdmissaoWizardClient";
import { resolveSecretariaEscolaIdForPage } from "@/lib/secretaria/resolveSecretariaEscolaIdForPage";

export const dynamic = 'force-dynamic'

type PageProps = {
  params?: Promise<{ id?: string }>;
};

export default async function Page({ params }: PageProps = {}) {
  const routeParams = params ? await params : null;
  const s = await supabaseServer()
  const { data: sess } = await s.auth.getUser()
  const user = sess?.user
  let escolaId: string | null = null
  if (user) {
    escolaId = await resolveSecretariaEscolaIdForPage(
      s as any,
      user.id,
      routeParams?.id ?? null
    )
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
