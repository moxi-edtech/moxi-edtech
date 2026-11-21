import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import DashboardLoader from "@/components/aluno/dashboard/DashboardLoader";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="dashboard" />
      <Suspense fallback={<div role="status" aria-busy="true" aria-label="A carregar início" className="space-y-3"><span className="sr-only">A carregar início</span><div aria-hidden="true" className="h-32 rounded-xl border border-border bg-muted motion-safe:animate-pulse" /></div>}>
        <DashboardLoader />
      </Suspense>
    </div>
  );
}
