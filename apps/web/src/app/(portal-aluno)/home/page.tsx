import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabHome } from "@/components/aluno/tabs/TabHome";

export default function HomePage() {
  return (
    <div className="klasse-portal-theme mx-auto min-h-screen max-w-[1200px] space-y-4 bg-muted/25 p-4 md:p-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="home" />
      <Suspense fallback={<div role="status" aria-label="A carregar início" className="h-32 animate-pulse rounded-xl border border-border bg-card" />}>
        <TabHome />
      </Suspense>
    </div>
  );
}
