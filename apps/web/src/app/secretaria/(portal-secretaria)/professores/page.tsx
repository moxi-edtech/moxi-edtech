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
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded text-klasse-gold-800 text-sm">
          Vincule seu perfil a uma escola para ver professores.
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="professores_list" />
      <DashboardHeader
        title="Professores"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Professores" },
        ]}
      />
      <ProfessoresListClient />
    </div>
  );
}
