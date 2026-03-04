import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { AcademicoAccordion } from "@/components/aluno/academico/AcademicoAccordion";

export default function AcademicoPage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" />
      <Suspense fallback={<div className="h-32 rounded-2xl bg-white" />}> 
        <AcademicoAccordion />
      </Suspense>
    </div>
  );
}
