import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { AcademicoWorkspace } from "@/components/aluno/academico/AcademicoWorkspace";

export default function AcademicoPage() {
  return (
    <div className="min-w-0">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" />
      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-muted" />}>
        <AcademicoWorkspace />
      </Suspense>
    </div>
  );
}
