import CobrancasListClient from "@/components/super-admin/cobrancas/CobrancasListClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="billing_list" />
      <DashboardHeader
        title="Cobranças SaaS"
        description="Gestão de planos, subscrições e pagamentos das escolas no ecossistema Klasse."
      />
      <CobrancasListClient />
    </>
  );
}
