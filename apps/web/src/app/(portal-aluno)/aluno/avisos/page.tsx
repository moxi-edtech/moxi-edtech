import AuditPageView from "@/components/audit/AuditPageView";
import { AvisosList } from "@/components/aluno/avisos/AvisosList";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="avisos" />
      <AvisosList />
    </div>
  );
}

