import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { operationalCardTone, operationalCardIconClasses } from "../../src/lib/ui/operational-card-tone";

const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("Operações promotes daily workflows before management indicators without mounting a second hub", () => {
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const slot = dashboard.slice(dashboard.indexOf("afterCounters={"), dashboard.indexOf("      {/* ── 5. CHARTS"));
  assert.ok(slot.indexOf("<QuickActionsSection") < slot.indexOf("Visão geral da escola"));
  assert.ok(slot.indexOf("Visão geral da escola") < slot.indexOf("Recebido neste mês"));
  assert.match(hub, /\{afterCounters\}/);
  assert.match(hub, /Aulas por confirmar/);
  assert.match(dashboard, /\{!isOperacoes && <motion.div variants=\{itemVariants\}>\s*<OperacoesPainelHub/);
  assert.equal((hub.match(/useOperacoesPendencias\(\{ onlyReopen \}\)/g) ?? []).length, 1);
});

test("academic context retains blocking and event details and finance does not invent a target", () => {
  const banner = source("components/layout/escola-admin/EstadoVitalBanner.tsx");
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  assert.match(banner, /Diário bloqueado/);
  assert.match(banner, /Evento de hoje/);
  assert.match(banner, /estado.evento_hoje_nome/);
  assert.match(dashboard, /Sem previsão definida/);
  assert.match(dashboard, /revenueDetailsOpen && hasMovimentoReceita/);
  assert.match(dashboard, /!isOperacoes \|\| radarAlerts.length > 0/);
});

test("single dashboard refresh and compact cards preserve actions", () => {
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const quick = source("components/layout/escola-admin/QuickActionsSection.tsx");
  const action = source("components/shared/AcaoRapidaCard.tsx");
  const expediente = source("components/secretaria/ExpedienteDashboardCard.tsx");
  assert.match(dashboard, /onRefreshDashboard=\{handleRefresh\}/);
  assert.doesNotMatch(dashboard, /isOperacoes && <button[^>]*onClick=\{handleRefresh\}/);
  assert.match(hub, /refresh\(\);\s*onRefreshDashboard\?\.\(\)/);
  assert.match(hub, /disabled=\{refreshing \|\| dashboardRefreshing\}/);
  assert.match(source("components/shared/OperationalMetricCard.tsx"), /aria-haspopup="dialog"/);
  assert.match(quick, /dashboardCompact=\{portalBase === "operacoes"\}/);
  assert.match(expediente, /dashboardCompact=\{portal==="operacoes"\}/);
  assert.match(action, /ref=\{buttonRef\}/);
  assert.match(action, /disabled && disabledReason/);
});
test("pending and overdue cards use the same active academic year and cash over target is qualified", () => {
  const data = source("components/layout/escola-admin/EscolaAdminDashboardData.tsx");
  const kpi = source("components/layout/escola-admin/KpiSection.tsx");
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  assert.match(data, /mensalidadesPendentes: pagamentosResumo\.pendente/);
  assert.match(data, /mensalidadesInadimplentes: pagamentosResumo\.inadimplente/);
  assert.match(kpi, /Não vencidas · ano activo/);
  assert.match(dashboard, /hasMetaReceita && rawPercentualReceita > 100/);
  assert.match(dashboard, /dívidas antigas, adiantamentos ou serviços/);
});

test("financial status failures do not masquerade as zero", () => {
  const data = source("components/layout/escola-admin/EscolaAdminDashboardData.tsx");
  const kpi = source("components/layout/escola-admin/KpiSection.tsx");
  const focus = source("components/layout/escola-admin/OperationalFocusSection.tsx");
  assert.match(data, /mensalidadesStatusDisponivel = !mensalidadesStatusResult\.error/);
  assert.match(kpi, /propinasDisponiveis \? op\.mensalidadesPendentes : undefined/);
  assert.match(kpi, /propinasDisponiveis \? op\.mensalidadesInadimplentes : undefined/);
  assert.match(focus, /mensalidadesStatusDisponivel === false \? null/);
});

test("Operações preserves branded green icon containers and exactly five daily shortcuts including provas", () => {
  const quick = source("components/layout/escola-admin/QuickActionsSection.tsx");
  const action = source("components/shared/AcaoRapidaCard.tsx");
  const kpi = source("components/dashboard/KpiCard.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const css = source("app/globals.css");
  const list = quick.match(/const actions: QuickAction\[\] = portalBase === "operacoes"\s*\? \[([\s\S]*?)\]\s*:\s*\[/);
  assert.ok(list);
  assert.deepEqual([...list[1].matchAll(/key: "([^"]+)"/g)].map((match) => match[1]), ["recebimentos", "horarios", "provas", "criar_aviso"]);
  assert.match(list[1], /key: "provas",\s*label: "Central de provas",\s*icon: ClipboardCheck,\s*href: buildPortalHref\(escolaParam, "\/operacoes\/provas"\)/);
  assert.doesNotMatch(list[1], /Nova Matrícula|Nova Admissão|Importar Alunos/);
  assert.match(quick, /<ExpedienteDashboardCard escolaId=\{escolaId\} portal=\{portalBase\}/);
  assert.match(quick, /Novo Funcionário/);
  assert.match(quick, /Lançar Nota/);
  assert.match(action, /operationalCardTone\(\{ unavailable: disabled \|\| unavailable, needsAttention \}\)/);
  assert.match(action, /operationalCardIconClasses\[tone\]/);
  assert.match(kpi, /needsAttention=\{variant === "warning"\}/);
  assert.match(hub, /needsAttention=\{value > 0\}/);
  assert.match(source("components/shared/OperationalMetricCard.tsx"), /operationalCardTone\(\{ unavailable, needsAttention \}\)/);
  assert.doesNotMatch(css, /\.operations-actions-grid \{ grid-template-columns: repeat\(3,/);
});

test("operational icon semantics are contextual, not decorative", () => {
  assert.equal(operationalCardTone(), "normal");
  assert.equal(operationalCardTone({ needsAttention: 0 > 0 }), "normal");
  assert.equal(operationalCardTone({ needsAttention: 3 > 0 }), "attention");
  assert.equal(operationalCardTone({ unavailable: true }), "neutral");
  assert.equal(operationalCardTone({ unavailable: true, needsAttention: true }), "neutral");
  assert.match(operationalCardIconClasses.normal, /bg-emerald\/10 text-emerald/);
  assert.match(operationalCardIconClasses.attention, /bg-amber\/15 text-amber-700/);
  assert.match(operationalCardIconClasses.neutral, /bg-muted text-muted-foreground/);
  const expediente = source("components/secretaria/ExpedienteDashboardCard.tsx");
  assert.match(expediente, /needsAttention=\{portal==="operacoes" && \(\(summary\?\.pendingCount\?\?0\)>0 \|\| \(summary\?\.rejectedCount\?\?0\)>0\)\}/);
  const kpi = source("components/layout/escola-admin/KpiSection.tsx");
  assert.match(kpi, /op\.mensalidadesPendentes > 0 \? \("warning"/);
  assert.match(kpi, /op\.mensalidadesInadimplentes > 0 \? \("warning"/);
});

test("operational card families share column thresholds and aligned metric rows", () => {
  const css = source("app/globals.css");
  const kpi = source("components/dashboard/KpiCard.tsx");
  const kpiSection = source("components/layout/escola-admin/KpiSection.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const action = source("components/shared/AcaoRapidaCard.tsx");
  assert.match(css, /@container \(min-width: 480px\)\s*\{\s*\.operations-actions-grid, \.operations-kpi-grid \{ grid-template-columns: repeat\(2,/);
  assert.match(css, /@container \(min-width: 920px\)\s*\{\s*\.operations-actions-grid, \.operations-kpi-grid \{ grid-template-columns: repeat\(4,/);
  assert.match(css, /grid-auto-rows: 1fr;/);
  assert.match(css, /\.operations-metric-header \{[\s\S]*?min-height: 2\.5rem;/);
  const metric = source("components/shared/OperationalMetricCard.tsx");
  assert.match(kpi, /return <OperationalMetricCard/);
  assert.match(hub, /<OperationalMetricCard/);
  assert.match(kpiSection, /<OperationalMetricSkeleton key=\{i\}/);
  assert.match(hub, /<OperationalMetricSkeleton key=\{i\}/);
  assert.match(metric, /operations-metric-card operations-metric-size/);
  assert.match(metric, /className="operations-metric-value"/);
  assert.match(css, /\.operations-metric-size \{ min-height: 7\.5rem; \}/);
  assert.doesNotMatch(css, /\.operations-metric-(daily|summary)\s*\{/);
  assert.equal((hub.match(/dashboardCompact=\{Boolean\(afterCounters\)\}/g) ?? []).length, 4);
  assert.match(action, /h-full min-h-\[88px\]/);
});

test("operations dashboard uses a consistent breathing rhythm without changing the admin layout", () => {
  const css = source("app/globals.css");
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const quick = source("components/layout/escola-admin/QuickActionsSection.tsx");
  const kpi = source("components/dashboard/KpiCard.tsx");
  const action = source("components/shared/AcaoRapidaCard.tsx");
  assert.match(css, /\.operations-dashboard-flow \{ display: flex; flex-direction: column; gap: 1\.75rem; \}/);
  assert.match(css, /\.operations-dashboard-flow \{ gap: 2rem; \}/);
  assert.match(css, /grid-auto-rows: 1fr;\s*align-items: stretch;\s*gap: 1rem;/);
  assert.match(dashboard, /isOperacoes \? "operations-dashboard-flow min-w-0 pb-10" : "min-w-0 space-y-5/);
  assert.match(hub, /afterCounters \? "operations-dashboard-flow min-w-0"/);
  assert.match(quick, /mb-4 text-base font-semibold text-foreground">Ações rápidas/);
  assert.match(kpi, /return <OperationalMetricCard/);
  assert.match(source("components/shared/OperationalMetricCard.tsx"), /operations-metric-size rounded-xl border border-border bg-card p-4/);
  assert.match(action, /min-h-\[88px\][^"]*bg-card p-4/);
});

test("the two metric sections share one card and preserve financial scope and missing values", () => {
  const metric = source("components/shared/OperationalMetricCard.tsx");
  const dashboard = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  assert.match(metric, /value == null/);
  assert.match(metric, /!Number\.isFinite\(value\)/);
  assert.match(metric, /unavailable && <span[^>]*>Dados indisponíveis/);
  assert.match(metric, /description && !unavailable && <span className="sr-only"/);
  assert.match(metric, /if \(href\) return <Link href=\{href\}/);
  assert.match(metric, /if \(onClick\) return <button type="button"/);
  assert.match(dashboard, /Propinas do ano activo · pendentes não vencidas/);
});

test("compact KPI passes explicit navigation or static props without optional href union", () => {
  const kpi = source("components/dashboard/KpiCard.tsx");
  const compact = kpi.slice(kpi.indexOf("if (compact)"), kpi.indexOf("const Content ="));
  assert.match(compact, /if \(href\) \{\s*return <OperationalMetricCard[^>]*href=\{href\}/);
  assert.match(compact, /\}\s*return <OperationalMetricCard[^>]*description=\{description\} \/>/);
  assert.doesNotMatch(compact, /\.\.\.\(href/);
});
