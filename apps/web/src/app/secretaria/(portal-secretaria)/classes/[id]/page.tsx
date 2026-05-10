import ClasseDetailClient from "@/components/secretaria/ClasseDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: any }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="classe_detail" entityId={id} />
      <DashboardHeader
        title="Detalhe da Classe"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Classes", href: "/secretaria/classes" },
          { label: "Detalhe" },
        ]}
      />
      <ClasseDetailClient classeId={id} />
    </div>
  );
}
