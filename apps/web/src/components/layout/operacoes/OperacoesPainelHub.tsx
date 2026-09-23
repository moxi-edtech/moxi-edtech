"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileText,
  Inbox,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import SecaoLabel from "@/components/shared/SecaoLabel";
import AcaoRapidaCard from "@/components/shared/AcaoRapidaCard";
import StatCard from "@/components/shared/StatCard";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";
import ChartsSection from "@/components/layout/escola-admin/ChartsSection";
import OperationalFeedSection from "@/components/layout/escola-admin/OperationalFeedSection";
import OperationalFocusSection from "@/components/layout/escola-admin/OperationalFocusSection";
import type { DashboardCharts, OperationalSnapshot } from "@/components/layout/escola-admin/dashboard.types";
import AulasOperacionaisPanel from "./AulasOperacionaisPanel";
import PlanosAulaReviewPanel from "./PlanosAulaReviewPanel";
import NotasReaberturaPanel from "./NotasReaberturaPanel";
import { useOperacoesPendencias } from "./useOperacoesPendencias";

type Props = {
  escolaId: string;
  operationalSnapshot?: OperationalSnapshot;
  charts?: DashboardCharts;
};

type PainelId = "aulas" | "planos" | "reabertura" | "foco" | "graficos";

export default function OperacoesPainelHub({ escolaId, operationalSnapshot, charts }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { summary, loading, refreshing, error, refresh } = useOperacoesPendencias();
  const [aberto, setAberto] = useState<PainelId | null>(null);

  const fechar = () => setAberto(null);

  const contadores: Array<{
    id: PainelId;
    icon: LucideIcon;
    label: string;
    value: number;
    tone?: "default" | "warning";
  }> = [
    {
      id: "aulas",
      icon: Activity,
      label: "Aulas de hoje",
      value: summary.aulasAguardando,
      tone: summary.aulasAguardando > 0 ? "warning" : "default",
    },
    {
      id: "planos",
      icon: FileText,
      label: "Planos de aula",
      value: summary.planosRevisao,
    },
    {
      id: "reabertura",
      icon: ClipboardCheck,
      label: "Reabertura de notas",
      value: summary.reaberturasNotas,
    },
  ];

  return (
    <section aria-label="Operação" className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SecaoLabel>Operação</SecaoLabel>
          <div className="flex items-center gap-2">
            {operationalSnapshot && (
              <button
                type="button"
                onClick={() => setAberto("foco")}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-emerald transition hover:bg-emerald-50"
              >
                Foco da operação
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Activity className={`h-3.5 w-3.5 ${refreshing ? "animate-pulse" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={refresh} className="mt-2 font-bold underline">
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="h-[104px] animate-pulse rounded-xl border border-slate-100 bg-white" />
                ))
              : contadores.map(({ id, icon: Icon, label, value, tone }) => (
                  <StatCard
                    key={id}
                    label={label}
                    value={value}
                    icon={<Icon className="h-4 w-4" />}
                    tone={tone}
                    onClick={() => setAberto(id)}
                  />
                ))}
          </div>
        )}
      </div>

      <div>
        <SecaoLabel>Financeiro</SecaoLabel>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <AcaoRapidaCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Inadimplência"
            sublabel="Radar de cobranças"
            href={buildPortalHref(escolaParam, "/operacoes/radar")}
          />
          <AcaoRapidaCard
            icon={<Wallet className="h-5 w-5" />}
            label="Recebimentos"
            sublabel="Validação de pagamentos"
            href={buildPortalHref(escolaParam, "/operacoes/recebimentos")}
          />
          <AcaoRapidaCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Gráficos"
            sublabel="Evolução e pagamentos"
            onClick={() => setAberto("graficos")}
          />
          <AcaoRapidaCard
            icon={<Inbox className="h-5 w-5" />}
            label="Turmas e alunos"
            sublabel="Matriz financeira por turma"
            href={buildPortalHref(escolaParam, "/operacoes/turmas-alunos")}
          />
        </div>
      </div>

      {/* O pulso da escola. Fica à vista de propósito: assina o canal realtime
          `operacoes-activity-{escolaId}` (useOperationalActivityFeed) e mostra o que
          está a acontecer agora. Esconder isto num modal tirava o tempo real da página. */}
      <OperationalFeedSection escolaId={escolaId} portalBase="operacoes" />

      <ModalShell
        open={aberto === "aulas"}
        onClose={fechar}
        title="Aulas de hoje"
        description="Acompanhamento académico do dia em tempo real"
      >
        <AulasOperacionaisPanel escolaId={escolaId} />
      </ModalShell>

      <ModalShell
        open={aberto === "planos"}
        onClose={fechar}
        title="Revisão de planos de aula"
        description="Aprovar ou devolver planos submetidos pelos professores"
      >
        <PlanosAulaReviewPanel />
      </ModalShell>

      <ModalShell
        open={aberto === "reabertura"}
        onClose={fechar}
        title="Reabertura de notas"
        description="Pedidos de professores a aguardar decisão"
      >
        <NotasReaberturaPanel />
      </ModalShell>

      <ModalShell
        open={aberto === "foco"}
        onClose={fechar}
        title="Foco da operação"
        description="Filas e bloqueios que movem a escola no dia-a-dia"
      >
        {operationalSnapshot && (
          <OperationalFocusSection escolaId={escolaId} snapshot={operationalSnapshot} />
        )}
      </ModalShell>

      <ModalShell open={aberto === "graficos"} onClose={fechar} title="Gráficos" description="Evolução de alunos e pagamentos">
        <ChartsSection
          meses={charts?.meses}
          alunosPorMes={charts?.alunosPorMes}
          pagamentos={charts?.pagamentos}
          pagamentosValores={charts?.pagamentosValores}
          mode="operacoes"
        />
      </ModalShell>
    </section>
  );
}
