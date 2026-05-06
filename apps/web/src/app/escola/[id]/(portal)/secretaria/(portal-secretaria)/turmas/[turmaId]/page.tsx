import AuditPageView from "@/components/audit/AuditPageView";
import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";

type Params = {
  id: string;
  turmaId: string;
};

export default async function TurmaDetailEscolaPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id: escolaId, turmaId } = await params;

  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turma_detail" entityId={turmaId} escolaId={escolaId} />
      <TurmaDetailClient turmaId={turmaId} escolaParam={escolaId} />
    </>
  );
}
