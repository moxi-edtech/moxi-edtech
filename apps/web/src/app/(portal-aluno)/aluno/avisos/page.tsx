import AuditPageView from "@/components/audit/AuditPageView";
import { TabNotificacoes } from "@/components/aluno/tabs/TabNotificacoes";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="avisos" />
      <TabNotificacoes />
    </div>
  );
}
