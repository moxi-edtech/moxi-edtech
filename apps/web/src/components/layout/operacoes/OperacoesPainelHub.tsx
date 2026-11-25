"use client";

import { useRef, useState, type ReactNode } from "react";
import { OperationalMetricCard, OperationalMetricSkeleton } from "@/components/shared/OperationalMetricCard";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  RefreshCw,
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
  /** Mostra apenas a fila de decisões, sem replicar os restantes KPIs. */
  onlyReopen?: boolean;
  /** Conteúdo entre os contadores e os painéis secundários; mantém um só hub. */
  afterCounters?: ReactNode;
  onRefreshDashboard?: () => void;
  dashboardRefreshing?: boolean;
};

type PainelId = "aulas" | "planos" | "reabertura" | "foco" | "graficos";

export default function OperacoesPainelHub({ escolaId, operationalSnapshot, charts, onlyReopen = false, afterCounters, onRefreshDashboard, dashboardRefreshing = false }: Props) {
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const { summary, authorized, loading, refreshing, error, refresh } = useOperacoesPendencias({ onlyReopen });
  const [aberto, setAberto] = useState<PainelId | null>(null);

  const counterTrigger = useRef<HTMLButtonElement | null>(null);
  const fechar = () => {
    setAberto(null);
    const trigger = counterTrigger.current;
    counterTrigger.current = null;
    if (trigger) window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
  };
  const refreshDashboard = () => {
    refresh();
    onRefreshDashboard?.();
  };

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
      label: afterCounters ? "Aulas por confirmar" : "Aulas de hoje",
      value: summary.aulasAguardando,
      tone: summary.aulasAguardando > 0 ? "warning" : "default",
    },
    {
      id: "planos",
      icon: FileText,
      label: afterCounters ? "Planos por rever" : "Planos de aula",
      value: summary.planosRevisao,
      tone: afterCounters && summary.planosRevisao > 0 ? "warning" : "default",
    },
    {
      id: "reabertura",
      icon: ClipboardCheck,
      label: "Reabertura de notas",
      value: summary.reaberturasNotas,
      tone: afterCounters && summary.reaberturasNotas > 0 ? "warning" : "default",
    },
  ];

  if (onlyReopen && !authorized) return null;

  return (
    <section aria-label={onlyReopen ? "Solicitações académicas" : "Operação"} className={afterCounters ? "operations-dashboard-flow min-w-0" : "space-y-5 min-[1700px]:space-y-8"}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {afterCounters ? <h2 className="text-base font-semibold text-foreground">Acompanhamento diário</h2> : <SecaoLabel>{onlyReopen ? "Solicitações académicas" : "Operação"}</SecaoLabel>}
          <div className="flex items-center gap-2">
            {operationalSnapshot && !onlyReopen && (
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
              onClick={refreshDashboard}
              disabled={refreshing || dashboardRefreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 transition hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${refreshing || dashboardRefreshing ? "motion-safe:animate-spin" : ""}`} />
              {onRefreshDashboard ? "Atualizar painel" : "Atualizar"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            <p className="font-semibold">{error}</p>
            <button type="button" onClick={refresh} disabled={refreshing} className="mt-2 font-bold underline disabled:opacity-60">
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className={afterCounters ? "operations-daily-grid mt-4 grid" : "mt-3 grid grid-cols-2 gap-3 min-[1280px]:grid-cols-3 min-[1700px]:mt-4 min-[1700px]:gap-4"}>
            {loading
              ? (onlyReopen ? [0] : [0, 1, 2]).map((i) => (
                  afterCounters ? <OperationalMetricSkeleton key={i} /> : <div key={i} className="h-[104px] motion-safe:animate-pulse rounded-xl border border-border bg-card" />
                ))
              : contadores.filter(({ id }) => !onlyReopen || id === "reabertura").map(({ id, icon: Icon, label, value, tone }) => (
                  afterCounters ? (
                    <OperationalMetricCard
                      key={id}
                      label={label}
                      value={value}
                      icon={Icon}
                      needsAttention={value > 0}
                      dialogOpen={aberto === id}
                      onClick={(event) => { counterTrigger.current = event.currentTarget; setAberto(id); }}
                    />
                  ) : <StatCard
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

      {!onlyReopen && (<>
      {afterCounters}
      <div>
        {afterCounters ? <h2 className="text-base font-semibold text-foreground">Financeiro</h2> : <SecaoLabel>Financeiro</SecaoLabel>}
        <div className={afterCounters ? "operations-actions-grid mt-4 grid" : "mt-3 grid grid-cols-2 gap-3 min-[1280px]:grid-cols-4 min-[1700px]:mt-4 min-[1700px]:gap-4"}>
          <AcaoRapidaCard
            dashboardCompact={Boolean(afterCounters)}
            icon={<TrendingUp className="h-5 w-5" />}
            label="Inadimplência"
            needsAttention={Boolean(afterCounters) && operationalSnapshot?.mensalidadesStatusDisponivel !== false && (operationalSnapshot?.mensalidadesInadimplentes ?? 0) > 0}
            sublabel="Radar de cobranças"
            href={buildPortalHref(escolaParam, "/operacoes/radar")}
          />
          <AcaoRapidaCard
            dashboardCompact={Boolean(afterCounters)}
            icon={<Wallet className="h-5 w-5" />}
            label={afterCounters ? "Recebimentos completos" : "Recebimentos"}
            sublabel={afterCounters ? undefined : "Validação de pagamentos"}
            href={buildPortalHref(escolaParam, "/operacoes/recebimentos")}
          />
          <AcaoRapidaCard
            dashboardCompact={Boolean(afterCounters)}
            icon={<BarChart3 className="h-5 w-5" />}
            label="Gráficos"
            sublabel="Evolução e pagamentos"
            onClick={() => setAberto("graficos")}
          />
          <AcaoRapidaCard
            dashboardCompact={Boolean(afterCounters)}
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

      </>)}

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
        <NotasReaberturaPanel onDecided={refresh} />
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
