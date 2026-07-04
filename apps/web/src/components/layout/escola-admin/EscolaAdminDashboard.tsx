// apps/web/src/components/layout/escola-admin/EscolaAdminDashboard.tsx

import EscolaAdminDashboardData from "./EscolaAdminDashboardData";

type Props = {
  escolaId: string;
  escolaNome?: string;
  mode?: "admin" | "operacoes";
};

export default function EscolaAdminDashboard({
  escolaId,
  escolaNome,
  mode = "admin",
}: Props) {
  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <EscolaAdminDashboardData escolaId={escolaId} escolaNome={escolaNome} mode={mode} />
    </div>
  );
}
