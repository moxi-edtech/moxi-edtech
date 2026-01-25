import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default async function Page({
  params,
}: {
  params: Promise<{ turmaId: string }>;
}) {
  const { turmaId } = await params;

  return (
    <>
      <AuditPageView portal="admin" acao="PAGE_VIEW" entity="turma_detail" entityId={turmaId} />
      <TurmaDetailClient turmaId={turmaId} />
    </>
  );
}
