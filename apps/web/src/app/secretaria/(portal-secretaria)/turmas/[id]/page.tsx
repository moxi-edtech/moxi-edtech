import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default async function Page({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turma_detail" entityId={id} />
      <TurmaDetailClient turmaId={id} />
    </>
  );
}