import EscolaAdminSidebar from "@/components/escola-admin/Sidebar";
import AppHeader from "@/components/layout/shared/AppHeader";
import EscolaAdminDashboardData from "./EscolaAdminDashboardData";

type Props = { escolaId: string; escolaNome?: string };

export default function EscolaAdminDashboard({ escolaId, escolaNome }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <EscolaAdminSidebar escolaId={escolaId} />
      <div className="flex-1">
        <AppHeader title="Dashboard" />
        <main className="p-6">
          <EscolaAdminDashboardData escolaId={escolaId} escolaNome={escolaNome} />
        </main>
      </div>
    </div>
  );
}
