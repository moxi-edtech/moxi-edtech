import ClasseDetailClient from "@/components/secretaria/ClasseDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="classe_detail" entityId={params.id} />
      <ClasseDetailClient classeId={params.id} />
    </>
  );
}
