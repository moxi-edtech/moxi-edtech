import ImportacoesListClient from "@/components/secretaria/ImportacoesListClient";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export const dynamic = "force-dynamic";

export default function ImportacoesPage() {
  return (
    <div className="space-y-4">
      <DashboardHeader
        title="Importações"
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Importações" },
        ]}
      />
      <ImportacoesListClient />
    </div>
  );
}
