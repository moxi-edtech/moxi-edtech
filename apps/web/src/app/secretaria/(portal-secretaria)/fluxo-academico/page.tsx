import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import Mermaid from "@/components/Mermaid";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { fluxoAcademico } from "@/lib/diagrams";

export const dynamic = 'force-dynamic'

export default function Page() {
  return (
    <div className={`${PORTAL_PAGE_INSET} space-y-4`}>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="fluxo_academico" />
      <div className="mb-4">
        <DashboardHeader
          title="Fluxo Acadêmico"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Fluxo Acadêmico" },
          ]}
        />
      </div>
      <Mermaid chart={fluxoAcademico} className="overflow-auto rounded-lg border bg-card p-4" />
    </div>
  );
}
