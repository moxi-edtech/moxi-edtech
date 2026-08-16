import OperacoesDashboardData from "./OperacoesDashboardData";
import AulasOperacionaisPanel from "./AulasOperacionaisPanel";
import OperacoesPendenciasSummary from "./OperacoesPendenciasSummary";
import PlanosAulaReviewPanel from "./PlanosAulaReviewPanel";
import NotasReaberturaPanel from "./NotasReaberturaPanel";

type Props = {
  escolaId: string;
  escolaNome?: string;
};

export default function OperacoesDashboard({ escolaId, escolaNome }: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6 pb-12 font-sans lg:p-8 lg:pb-16">
      <OperacoesDashboardData escolaId={escolaId} escolaNome={escolaNome} />

      <section aria-label="Detalhes da operação" className="space-y-6">
        <OperacoesPendenciasSummary />
        <AulasOperacionaisPanel escolaId={escolaId} />
        <PlanosAulaReviewPanel />
        <NotasReaberturaPanel />
      </section>
    </div>
  );
}
