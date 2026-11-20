import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
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
    <div className={`${PORTAL_PAGE_INSET} space-y-6 min-[1700px]:space-y-8`}>
      <EscolaAdminDashboardData escolaId={escolaId} escolaNome={escolaNome} mode={mode} />
    </div>
  );
}
