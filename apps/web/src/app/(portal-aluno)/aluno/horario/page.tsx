import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabHorario } from "@/components/aluno/tabs/TabHorario";

export default function HorarioPage() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="horario" />
      <Suspense fallback={<div className="h-32 rounded-2xl bg-white animate-pulse" />}>
        <TabHorario />
      </Suspense>
    </div>
  );
}
