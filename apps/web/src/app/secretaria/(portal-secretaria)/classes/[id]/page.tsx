import ClasseDetailClient from "@/components/secretaria/ClasseDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: any }) {
  const { id } = await params;
  return (
    <>
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="classe_detail" entityId={id} />
      <ClasseDetailClient classeId={id} />
    </>
  );
}
