import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turma_detail" entityId={params.id} />
      <TurmaDetailClient turmaId={params.id} />
    </>
  );
}
