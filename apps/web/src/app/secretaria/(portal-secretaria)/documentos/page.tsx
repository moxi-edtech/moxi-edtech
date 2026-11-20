import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
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
        <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} py-8`}><div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Vincule seu perfil a uma escola para emitir documentos.
        </div></div>
      </>
    );
  }

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos" />
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Documentos"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Documentos" },
        ]}
      />
      </div>
      <SecretariaDocumentosWorkspace escolaId={escolaId} />
    </>
  );
}
