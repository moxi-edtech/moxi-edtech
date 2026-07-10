import "server-only";

import EscolaAdminDashboardData from "@/components/layout/escola-admin/EscolaAdminDashboardData";

type Props = {
  escolaId: string;
  escolaNome?: string;
};

export default async function OperacoesDashboardData({ escolaId, escolaNome }: Props) {
  return (
    <EscolaAdminDashboardData
      escolaId={escolaId}
      escolaNome={escolaNome}
      mode="operacoes"
    />
  );
}
