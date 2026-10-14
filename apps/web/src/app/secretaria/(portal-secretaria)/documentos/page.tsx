import AuditPageView from "@/components/audit/AuditPageView";
import SecretariaDocumentosWorkspace from "@/components/secretaria/SecretariaDocumentosWorkspace";
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
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Vincule seu perfil a uma escola para emitir documentos.
        </div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <DashboardHeader
        title="Documentos"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Documentos" },
        ]}
      />
      <SecretariaDocumentosWorkspace escolaId={escolaId} />
    </>
  );
}
