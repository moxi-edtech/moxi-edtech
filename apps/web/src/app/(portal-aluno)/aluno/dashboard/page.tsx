import AuditPageView from "@/components/audit/AuditPageView";
import DashboardLoader from "@/components/aluno/dashboard/DashboardLoader";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="dashboard" />
      <DashboardLoader />
    </div>
  );
}
