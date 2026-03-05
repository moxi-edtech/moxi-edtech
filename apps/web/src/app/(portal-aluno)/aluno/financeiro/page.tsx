import AuditPageView from "@/components/audit/AuditPageView";
import { TabFinanceiro } from "@/components/aluno/tabs/TabFinanceiro";

export default function Page() {
  return (
    <div className="space-y-4 bg-slate-50">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="financeiro_portal" />
      <TabFinanceiro />
    </div>
  );
}
