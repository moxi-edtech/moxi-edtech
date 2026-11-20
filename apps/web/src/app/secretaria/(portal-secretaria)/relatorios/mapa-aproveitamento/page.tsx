import { PORTAL_PAGE_HORIZONTAL_INSET } from "@/lib/layout/portal-page";
import MapaAproveitamentoClient from "./ui";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = "force-dynamic";

export default function MapaAproveitamentoPage() {
  return (
    <div className="space-y-4">
      <div className={`${PORTAL_PAGE_HORIZONTAL_INSET} pt-8`}>
      <DashboardHeader
        title="Mapa de Aproveitamento"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Relatórios", href: "/secretaria/relatorios" },
          { label: "Mapa de Aproveitamento" },
        ]}
      />
      </div>
      <MapaAproveitamentoClient />
    </div>
  );
}
