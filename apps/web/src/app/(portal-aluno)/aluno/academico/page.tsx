import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { AcademicoWorkspace } from "@/components/aluno/academico/AcademicoWorkspace";

export default function AcademicoPage() {
  return (
    <div className="min-w-0">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" />
      <Suspense fallback={<div role="status" aria-label="A carregar área académica" className="h-32 animate-pulse rounded-xl border border-border bg-card" />}>
        <AcademicoWorkspace />
      </Suspense>
    </div>
  );
}
