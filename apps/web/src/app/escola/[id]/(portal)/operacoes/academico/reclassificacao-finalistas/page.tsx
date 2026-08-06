import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { buildPortalHref } from "@/lib/navigation";
import { ReclassificacaoFinalistasClient } from "@/components/secretaria/virada-ano/ReclassificacaoFinalistasClient";

export const dynamic = "force-dynamic";

export default async function ReclassificacaoFinalistasOperacoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      <AuditPageView
        portal="admin_escola"
        acao="PAGE_VIEW"
        entity="reclassificacao_finalistas"
        entityId={null}
      />
      <DashboardHeader
        title="Reclassificação de Finalistas"
        description="Resolva alunos que concluíram um ciclo antes de definir o próximo destino académico."
        breadcrumbs={[
          { label: "Início", href: buildPortalHref(id, "/") },
          { label: "Operações", href: buildPortalHref(id, "/operacoes/dashboard") },
          { label: "Operações Académicas", href: buildPortalHref(id, "/operacoes/academico") },
          { label: "Finalistas" },
        ]}
      />
      <ReclassificacaoFinalistasClient />
    </main>
  );
}
