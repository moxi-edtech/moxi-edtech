import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import DashboardLoader from "@/components/aluno/dashboard/DashboardLoader";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="dashboard" />
      <Suspense fallback={<div role="status" aria-label="A carregar início" className="h-32 animate-pulse rounded-xl bg-muted" />}>
        <DashboardLoader />
      </Suspense>
    </div>
  );
}
