import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosEmissaoHubClient from "@/components/secretaria/DocumentosEmissaoHubClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null;

  if (!escolaId) {
    return (
      <>
        <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
        <div className="p-4 bg-klasse-gold-50 border border-klasse-gold-200 rounded-xl text-klasse-gold-800 text-sm">
          Vincule seu perfil a uma escola para emitir documentos.
        </div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <div className="p-4 md:p-6">
        <DashboardHeader
          title="Documentos"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Documentos" },
          ]}
        />
        <DocumentosEmissaoHubClient escolaId={escolaId} />
      </div>
    </>
  );
}
