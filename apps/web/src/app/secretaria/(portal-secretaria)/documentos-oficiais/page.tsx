import AuditPageView from "@/components/audit/AuditPageView";
import DocumentosOficiaisBatchClient from "@/components/secretaria/DocumentosOficiaisBatchClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="documentos_oficiais" />
      <DashboardHeader
        title="Documentos Oficiais"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Documentos Oficiais" },
        ]}
      />
      <DocumentosOficiaisBatchClient />
    </div>
  );
}
