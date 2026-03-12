import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; turmaId: string }>;
}) {
  const { id: escolaId, turmaId } = await params;

  return (
    <>
      <AuditPageView
        portal="admin_escola"
        acao="PAGE_VIEW"
        entity="turma_detail"
        entityId={turmaId}
        escolaId={escolaId}
      />
      <TurmaDetailClient turmaId={turmaId} />
    </>
  );
}
