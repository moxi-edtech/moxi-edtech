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
    <div className="mx-auto w-full max-w-6xl space-y-6 p-0 min-[1700px]:space-y-8 min-[1700px]:p-8">
      <EscolaAdminDashboardData escolaId={escolaId} escolaNome={escolaNome} mode={mode} />
    </div>
  );
}
