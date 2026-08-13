import OperacoesDashboardData from "./OperacoesDashboardData";
import AulasOperacionaisPanel from "./AulasOperacionaisPanel";
import PlanosAulaReviewPanel from "./PlanosAulaReviewPanel";
import NotasReaberturaPanel from "./NotasReaberturaPanel";

type Props = {
  escolaId: string;
  escolaNome?: string;
};

export default function OperacoesDashboard({ escolaId, escolaNome }: Props) {
  return (
    <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
      <AulasOperacionaisPanel escolaId={escolaId} />
      <PlanosAulaReviewPanel />
      <NotasReaberturaPanel />
      <OperacoesDashboardData escolaId={escolaId} escolaNome={escolaNome} />
    </div>
  );
}
