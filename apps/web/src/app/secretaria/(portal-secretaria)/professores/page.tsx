import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import { supabaseServer } from "@/lib/supabaseServer";
import AuditPageView from "@/components/audit/AuditPageView";
import ProfessoresListClient from "@/components/secretaria/ProfessoresListClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  let escolaId: string | null = null;

  if (user) {
    const { data: prof } = await s
      .from('profiles')
      .select('escola_id')
      .eq('user_id', user.id)
      .maybeSingle();
    escolaId = (prof as any)?.escola_id ?? null;
  }

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="professores_list" />
        <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} py-8`}><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Vincule seu perfil a uma escola para ver professores.
        </div></div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="professores_list" />
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Professores"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Professores" },
        ]}
      />
      </div>
      <ProfessoresListClient />
    </div>
  );
}
