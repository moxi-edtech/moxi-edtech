import { DashboardHeader } from "@/components/layout/DashboardHeader";
import RelatorioMensalidadesClient from "@/components/secretaria/RelatorioMensalidadesClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Relatório de Mensalidades"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Relatórios", href: "/secretaria/relatorios" },
          { label: "Mensalidades" },
        ]}
      />
      <RelatorioMensalidadesClient />
    </div>
  );
}
