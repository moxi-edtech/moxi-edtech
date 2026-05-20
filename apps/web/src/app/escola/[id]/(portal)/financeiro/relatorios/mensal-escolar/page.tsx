import RelatorioMensalidadesClient from "@/components/secretaria/RelatorioMensalidadesClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = "force-dynamic";

export default async function MensalEscolarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: escolaId } = await params;

  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Relatório Mensal Escolar"
        breadcrumbs={[
          { label: "Início", href: `/escola/${escolaId}` },
          { label: "Financeiro", href: `/escola/${escolaId}/financeiro` },
          { label: "Relatórios", href: `/escola/${escolaId}/financeiro/relatorios` },
          { label: "Mensal Escolar" },
        ]}
      />
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <RelatorioMensalidadesClient />
      </div>
    </div>
  );
}
