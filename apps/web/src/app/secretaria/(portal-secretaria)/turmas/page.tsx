import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import AuditPageView from "@/components/audit/AuditPageView";
import TurmasListClient from "@/components/secretaria/TurmasListClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turmas_list" />
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Turmas"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Turmas" },
        ]}
      />
      </div>
      <TurmasListClient />
    </div>
  );
}
