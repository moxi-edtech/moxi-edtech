import OperacoesDashboardData from "./OperacoesDashboardData";

type Props = {
  escolaId: string;
  escolaNome?: string;
};

/**
 * O AppShell já fornece o fundo (bg-slate-50) e o padding da página (p-4 md:p-6).
 * Aqui define-se apenas a largura de leitura e o ritmo vertical.
 *
 * Os painéis operacionais deixaram de ser empilhados no fim da página: vivem no
 * OperacoesPainelHub, dentro do EscolaAdminDashboardContent, abertos por modal.
 */
export default function OperacoesDashboard({ escolaId, escolaNome }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <OperacoesDashboardData escolaId={escolaId} escolaNome={escolaNome} />
    </div>
  );
}
