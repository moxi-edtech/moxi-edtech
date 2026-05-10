import TurmaDetailClient from "@/components/secretaria/TurmaDetailClient";
import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function Page({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  return (
    <div className="space-y-4">
      <AuditPageView portal="secretaria" acao="PAGE_VIEW" entity="turma_detail" entityId={id} />
      <DashboardHeader
        title="Detalhe da Turma"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Turmas", href: "/secretaria/turmas" },
          { label: "Detalhe" },
        ]}
      />
      <TurmaDetailClient turmaId={id} />
    </div>
  );
}
