import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import PartnerCommissionsClient from "@/components/super-admin/comissoes/PartnerCommissionsClient";

export const dynamic = "force-dynamic";

export default function SuperAdminCommissionsPage() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="partner_commissions_cockpit" />
      <DashboardHeader
        title="Comissões de Parceiros"
        description="Cockpit administrativo para aprovar, bloquear, pagar e reabrir comissões geradas pelo funil comercial."
        breadcrumbs={[
          { label: "Super Admin", href: "/super-admin" },
          { label: "Comissões" },
        ]}
      />
      <PartnerCommissionsClient />
    </div>
  );
}
