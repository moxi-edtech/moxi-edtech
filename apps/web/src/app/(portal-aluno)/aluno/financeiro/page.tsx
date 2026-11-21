import AuditPageView from "@/components/audit/AuditPageView";
import { TabFinanceiro } from "@/components/aluno/tabs/TabFinanceiro";

export default function Page() {
  return (
    <div className="min-w-0 space-y-4">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="financeiro_portal" />
      <TabFinanceiro />
    </div>
  );
}
