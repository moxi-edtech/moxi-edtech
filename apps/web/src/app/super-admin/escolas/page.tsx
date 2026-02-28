import SchoolsTableClient from "@/components/super-admin/escolas/SchoolsTableClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export const dynamic = 'force-dynamic'

export default async function Page() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escolas_list" />
      <DashboardHeader
        title="Escolas"
        description="Visão global das escolas activas e progresso de onboarding."
      />
      <SchoolsTableClient
        initialSchools={[]}
        initialProgress={{}}
        initialErrorMsg={null}
        fallbackSource={null}
      />
    </>
  );
}
