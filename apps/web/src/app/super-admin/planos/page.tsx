import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import PlanosComerciaisClient from "@/components/super-admin/planos/PlanosComerciaisClient";

export const dynamic = "force-dynamic";

export default function SuperAdminPlanosPage() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="plans_commercial_settings" />
      <DashboardHeader
        title="Planos e Preços"
        description="Configuração comercial global dos planos SaaS: preços, promoções, descontos e período de teste."
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Planos e Preços" },
        ]}
      />
      <PlanosComerciaisClient />
    </div>
  );
}
