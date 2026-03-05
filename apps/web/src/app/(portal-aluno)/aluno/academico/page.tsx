import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabNotas } from "@/components/aluno/tabs/TabNotas";

export default function AcademicoPage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="academico" />
      <Suspense fallback={<div className="h-32 rounded-2xl bg-white" />}>
        <TabNotas />
      </Suspense>
    </div>
  );
}
