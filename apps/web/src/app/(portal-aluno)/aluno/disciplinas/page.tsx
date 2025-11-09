import AuditPageView from "@/components/audit/AuditPageView";
import { DisciplinasList } from "@/components/aluno/disciplinas/DisciplinasList";

export default function Page() {
  return (
    <div className="space-y-6">
      <AuditPageView portal="aluno" acao="PAGE_VIEW" entity="disciplinas" />
      <DisciplinasList />
    </div>
  );
}

