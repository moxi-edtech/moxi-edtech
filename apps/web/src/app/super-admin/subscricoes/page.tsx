import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import SubscricoesCockpitClient from "@/components/super-admin/subscricoes/SubscricoesCockpitClient";

export const dynamic = "force-dynamic";

export default function SuperAdminSubscricoesPage() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="formacao_subscriptions_cockpit" />
      <DashboardHeader
        title="Subscrições Formação"
        description="Cockpit comercial para trials, planos, lembretes e dados de cobrança da KLASSE."
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Subscrições" },
        ]}
      />
      <SubscricoesCockpitClient />
    </div>
  );
}
