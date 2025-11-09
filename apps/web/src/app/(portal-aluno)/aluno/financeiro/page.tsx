import AuditPageView from "@/components/audit/AuditPageView";
import { FinanceiroResumo } from "@/components/aluno/financeiro/FinanceiroResumo";
import { MensalidadesTable } from "@/components/aluno/financeiro/MensalidadesTable";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="financeiro" />
      <FinanceiroResumo />
      <MensalidadesTable />
    </div>
  );
}

