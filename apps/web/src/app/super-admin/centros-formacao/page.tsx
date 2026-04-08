import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import CentrosFormacaoTableClient from "@/components/super-admin/centros-formacao/CentrosFormacaoTableClient";

export const dynamic = "force-dynamic";

export default function CentrosFormacaoPage() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="centros_formacao_list" />
      <DashboardHeader
        title="Centros de Formação"
        description="Gestão de centros, estado do onboarding e capacidade operacional."
      />
      <CentrosFormacaoTableClient />
    </>
  );
}
