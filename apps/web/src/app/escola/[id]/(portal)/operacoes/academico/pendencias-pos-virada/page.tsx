import AuditPageView from "@/components/audit/AuditPageView";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { CentroPendenciasPosViradaClient } from "@/components/secretaria/operacoes/CentroPendenciasPosViradaClient";
import { buildPortalHref } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function PendenciasPosViradaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finalistasHref = buildPortalHref(id, "/operacoes/academico/reclassificacao-finalistas");
  const reviewHref = buildPortalHref(id, "/operacoes/rematricula");
  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <AuditPageView portal="admin_escola" acao="PAGE_VIEW" entity="pendencias_pos_virada" entityId={null} />
    <DashboardHeader title="Pendências pós-virada" description="Resolva dívidas, finalistas e casos que ficaram no ano anterior, sem repetir a virada." breadcrumbs={[{ label: "Início", href: buildPortalHref(id, "/") }, { label: "Operações", href: buildPortalHref(id, "/operacoes/dashboard") }, { label: "Operações Académicas", href: buildPortalHref(id, "/operacoes/academico") }, { label: "Pendências pós-virada" }]} />
    <CentroPendenciasPosViradaClient finalistasHref={finalistasHref} reviewHref={reviewHref} />
  </main>;
}
