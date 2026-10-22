import React from "react";
import { Users, UsersRound, Wallet, UserCheck, CheckCircle2 } from "lucide-react";
import { EstadoVitalBanner } from "../src/components/layout/escola-admin/EstadoVitalBanner";
import { RadarOperacional, type OperationalAlert } from "../src/components/feedback/FeedbackSystem";
import { KpiCard } from "../src/components/dashboard/KpiCard";
import OperationsFinanceSummary from "../src/components/layout/escola-admin/OperationsFinanceSummary";
import "../src/components/layout/escola-admin/operations-density.css";

type State = "pending" | "clean" | "empty" | "loading" | "error";
type Props = { state: State; baseline: boolean };
const moeda = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });
const status = {
  escola_id: "00000000-0000-4000-8000-0000000000a1",
  session_id: null, ano_ativo: 2026, periodo_id: null,
  periodo_tipo: "TRIMESTRE", periodo_numero: 1,
  hoje_bloqueado_pedagogico: false,
  evento_hoje_nome: "Aulas regulares",
  fase_operacional: "REGULAR" as const,
};
const pendingAlerts: OperationalAlert[] = [
  { id: "turmas-pendentes", titulo: "Duas turmas aguardam validação", descricao: "Rever turmas antes de prosseguir.", severity: "warning", categoria: "academico", link: "#turmas", link_label: "Ver turmas" },
];
const stats = [
  { label: "Alunos", value: 507, description: "Base activa", icon: Users, variant: "brand" as const },
  { label: "Turmas", value: 22, description: "Em circulação", icon: UsersRound, variant: "default" as const },
  { label: "Pendentes", value: 495, description: "Cobranças por tratar", icon: Wallet, variant: "warning" as const },
  { label: "Em atraso", value: 390, description: "Cobrança crítica", icon: UserCheck, variant: "warning" as const },
];
function FixtureIndicators({ state, baseline }: Props) {
  if (state === "error") return <div role="alert" data-testid="operations-kpi-error" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">Não foi possível carregar os indicadores. Tente novamente.</div>;
  if (state === "loading") return <div data-testid="operations-kpi-loading" className={baseline ? "fixture-before-kpis" : "operations-kpi-grid"}>{stats.map(s => <div key={s.label} className="h-24 animate-pulse rounded-xl border bg-white p-4"><span className="sr-only">A carregar {s.label}</span></div>)}</div>;
  return <div data-testid="operations-kpi-grid" className={baseline ? "fixture-before-kpis" : "operations-kpi-grid"}>
    {stats.map(s => <KpiCard key={s.label} label={s.label} value={state === "empty" ? "—" : s.value} description={s.description} icon={s.icon} variant={state === "empty" ? "default" : s.variant} compact responsiveDensity={!baseline} href={"#"+s.label} />)}
  </div>;
}
export default function OperationsDensityFixture({ state, baseline }: Props) {
  const alerts = state === "pending" ? pendingAlerts : [];
  return <div className="fixture-operations-shell" data-fixture="synthetic-only">
    <aside className="fixture-sidebar" aria-hidden="true">
      <strong>KLASSE</strong><small>gestão escolar</small>
      <p className="fixture-sidebar-active">Dashboard</p><p>Alunos</p><p>Matrículas & Admissões</p><p>Turmas & Classes</p><p>Financeiro</p>
    </aside>
    <div className="fixture-right">
      <header className="fixture-topbar"><strong>Buscar ou digitar ação...</strong><span>Operações · Escola sintética</span></header>
      <div className="fixture-year">Ano letivo 2026/2027</div>
      <main className="fixture-main">
        <div className={baseline ? "fixture-before-dashboard" : "operations-dashboard"} data-operations-dashboard={baseline ? undefined : ""}>
          <div className="operations-head">
            <h1 className="text-2xl font-black text-slate-900">Painel Operacional</h1>
            <p className="mt-1 text-sm text-slate-600">Boa tarde · Escola sintética · Ambiente de teste</p>
          </div>
          {baseline ? <>
            <EstadoVitalBanner estado={status} />
            <RadarOperacional alerts={alerts} role="secretaria" variant="compact" onAction={() => {}} />
          </> : <div data-testid="operations-overview" className="operations-status">
            <EstadoVitalBanner estado={status} inline />
            <RadarOperacional alerts={alerts} role="secretaria" variant="inline" onAction={() => {}} />
          </div>}
          <FixtureIndicators state={state} baseline={baseline} />
          {state === "empty" || state === "error" ? <p className="py-2 text-sm text-slate-700">Sem movimento de caixa para apresentar.</p> :
            state === "loading" ? <div className="h-40 animate-pulse rounded-xl border bg-white p-4" data-testid="operations-finance-loading">A carregar resumo financeiro…</div> :
            <div className={baseline ? "fixture-before-finance" : ""}>
              <OperationsFinanceSummary recebido={1756200} previsto={1733500} liquidadoCompetencia={418000} mensalidades={479000} dividasAnteriores={216500} servicos={1060700} percentualCaixa={101} percentualCompetencia={24} pacingTarget={71} acimaDaMeta formatMoney={v => moeda.format(v)} />
            </div>}
          <p className="fixture-following-content text-sm text-slate-600">Continuação do painel</p>
        </div>
      </main>
    </div>
  </div>;
}
