import TurmasListClient from "@/components/secretaria/TurmasListClient";
import AuditPageView from "@/components/audit/AuditPageView";

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  return (
    <>
      <AuditPageView
        portal="admin_escola"
        acao="PAGE_VIEW"
        entity="turmas_list"
        entityId={null}
        escolaId={escolaId}
      />
      <TurmasListClient adminMode />
    </>
  );
}
