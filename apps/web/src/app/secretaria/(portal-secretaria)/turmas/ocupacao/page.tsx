import OcupacaoClient from "@/components/secretaria/OcupacaoClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function Page() {
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turmas_ocupacao" />
      <DashboardHeader
        title="Ocupação das Turmas"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Turmas", href: "/secretaria/turmas" },
          { label: "Ocupação" },
        ]}
      />
      <OcupacaoClient />
    </div>
  );
}
