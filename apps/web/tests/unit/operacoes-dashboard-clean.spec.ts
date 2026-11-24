import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(hub, /aria-haspopup="dialog"/);
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
