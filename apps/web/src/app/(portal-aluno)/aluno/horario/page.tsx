import { Suspense } from "react";
import AuditPageView from "@/components/audit/AuditPageView";
import { TabHorario } from "@/components/aluno/tabs/TabHorario";

export default function HorarioPage() {
  return (
    <div className="min-w-0 space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="horario" />
      <Suspense fallback={<div role="status" aria-label="A carregar horário" className="h-32 animate-pulse rounded-xl border border-border bg-card" />}>
        <TabHorario />
      </Suspense>
    </div>
  );
}
