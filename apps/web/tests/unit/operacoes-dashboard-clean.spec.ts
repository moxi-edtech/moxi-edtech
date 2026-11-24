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
  assert.match(dashboard, /revenueDetailsOpen && hasMovimentoReceita && revenueSection/);
  assert.match(dashboard, /!isOperacoes \|\| radarAlerts.length > 0/);
});
