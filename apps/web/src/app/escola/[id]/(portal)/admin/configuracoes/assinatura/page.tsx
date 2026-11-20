import AssinaturaKlasseClient from "@/components/escola/configuracoes/AssinaturaKlasseClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
      <AuditPageView portal="admin_escola" acao="PAGE_VIEW" entity="billing_settings" />
      <DashboardHeader
        title="Assinatura Klasse"
        description="Faça a gestão da subscrição do seu portal, consulte faturas e envie comprovativos de pagamento."
      />
      <AssinaturaKlasseClient escolaId={escolaId} />
    </div>
  );
}
