import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("os três portais usam a mesma fila e o mesmo modal de decisão", () => {
  const shared = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const admin = source("components/layout/escola-admin/EscolaAdminDashboardContent.tsx");
  const secretaria = source("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  const panel = source("components/layout/operacoes/NotasReaberturaPanel.tsx");
  assert.match(shared, /<NotasReaberturaPanel onDecided=\{refresh\}/);
  // Operações mounts the full hub before the management summary; Admin mounts
  // the decision-only hub in its own mutually exclusive branch.
  const fullHub = admin.match(/\{isOperacoes \? \(\s*<OperacoesPainelHub\b([\s\S]*?)afterCounters=\{/);
  assert.ok(fullHub, "Operações must mount the shared full hub");
  assert.doesNotMatch(fullHub[1], /\bonlyReopen\b/);
  assert.match(shared, /\bonlyReopen\s*=\s*false\b/);
  const decisionHub = admin.match(/\{!isOperacoes && <motion\.div[^>]*>\s*<OperacoesPainelHub\b([^>]*?)\/>/);
  assert.ok(decisionHub, "Admin must mount the shared decision-only hub");
  assert.match(decisionHub[1], /\bonlyReopen\s*$/);
  assert.equal((admin.match(/<OperacoesPainelHub\b/g) ?? []).length, 2);
  assert.equal((shared.match(/useOperacoesPendencias\(\{ onlyReopen \}\)/g) ?? []).length, 1);
  assert.match(secretaria, /<OperacoesPainelHub escolaId=\{escolaId\} onlyReopen/);
  assert.match(panel, /method: "PATCH"/);
  assert.match(panel, /onDecided\?\.\(\)/);
});

test("admin consulta apenas reabertura e a API não duplica a fonte", () => {
  const hook = source("components/layout/operacoes/useOperacoesPendencias.ts");
  const api = source("app/api/secretaria/notas/reabertura/route.ts");
  assert.match(hook, /if \(onlyReopen\)/);
  assert.match(hook, /\/api\/secretaria\/notas\/reabertura/);
  assert.match(hook, /reaberturasNotas: payload\.total/);
  assert.match(hook, /setAuthorized\(false\)/);
  assert.match(api, /count: "exact"/);
  assert.match(api, /\.eq\("escola_id", escolaId\)/);
  assert.match(api, /\.eq\("status", requestedStatus\)/);
  assert.match(api, /requireRoleInSchool/);
});

test("o professor recebe apenas os próprios pedidos e não pode decidir", () => {
  const professor = source("components/professor/ProfessorReopeningRequests.tsx");
  const home = source("app/professor/page.tsx");
  const api = source("app/api/professor/notas/reabertura/route.ts");
  assert.match(home, /<ProfessorReopeningRequests assignments=\{atribs\}/);
  assert.match(professor, /\.map\(\(item\) =>/);
  assert.match(professor, /PENDENTE|APROVADO/);
  assert.match(api, /\.eq\("solicitado_por", user\.id\)/);
  assert.doesNotMatch(api, /export async function PATCH/);
});

test("secretaria prioriza a fila partilhada sem duplicar indicadores", () => {
  const dashboard = source("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  const cash = source("components/secretaria/ResumoCaixaSecretaria.tsx");
  const activity = source("components/secretaria/ExpedienteWorkspace.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const queue = dashboard.indexOf("<OperacoesPainelHub escolaId={escolaId} onlyReopen inlineReopen");
  assert.ok(queue > dashboard.indexOf('aria-labelledby="secretaria-caixa-title"'));
  assert.ok(queue < dashboard.indexOf('aria-labelledby="secretaria-atendimento-title"'));
  assert.equal((dashboard.match(/<OperacoesPainelHub\b/g) ?? []).length, 1);
  assert.doesNotMatch(dashboard, /RadarOperacional|showSignature=\{false\}/);
  assert.doesNotMatch(cash, /Pagamentos parciais|showPartialPayments/);
  assert.doesNotMatch(dashboard, /Minhas admissões|<MinhaProdutividade|Ver atividade do dia/);
  assert.match(activity, /Ver atividade do dia/);
  assert.match(dashboard, /label="Fichas incompletas"/);
  assert.match(dashboard, /Matrículas de hoje/);
  assert.match(hub, /const embeddedReopen = onlyReopen && inlineReopen/);
  assert.match(hub, /if \(onlyReopen && !authorized\) return null/);
});

test("fichas e avisos usam uma consulta, listas disjuntas e o drawer existente", () => {
  const dashboard = source("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  const notices = source("components/dashboard/NoticePanel.tsx");
  assert.equal((dashboard.match(/\/api\/secretaria\/balcao\/produtividade\?/g) ?? []).length, 1);
  assert.match(dashboard, /productivity\?\.scope === productivityScope/);
  assert.match(dashboard, /return \(\) => controller\.abort\(\)/);
  assert.match(dashboard, /avisos\.filter\(item => item\.type === "FICHA_RAPIDA"\)/);
  assert.match(dashboard, /avisos\.filter\(item => item\.type !== "FICHA_RAPIDA"\)/);
  assert.match(dashboard, /<PortalSheet\s+open=\{noticeView !== null\}/);
  assert.match(dashboard, /items=\{noticeView === "fichas" \? fichaAvisos : generalAvisos\}/);
  assert.match(dashboard, /onSuccess=\{refreshProdutividade\}/);
  assert.match(notices, /availableFiltersOnly = false/);
});

test("secretaria usa geometria central de desktop sem alterar os drawers mobile dos outros portais", () => {
  const dashboard = source("app/secretaria/(portal-secretaria)/Dashboard.tsx");
  const banner = source("components/layout/escola-admin/EstadoVitalBanner.tsx");
  const sheet = source("components/portal/ui/PortalSheet.tsx");
  const css = source("app/globals.css");
  const fila = source("components/secretaria/FilaAtendimentoModal.tsx");
  const shell = source("components/ui/ModalShell.tsx");
  const sheets = dashboard.match(/<PortalSheet\b[\s\S]*?>/g) ?? [];
  assert.equal(sheets.length, 3);
  for (const item of sheets) assert.match(item, /desktopPresentation="centered"/);
  assert.match(banner, /size="compact" desktopPresentation="centered"/);
  assert.match(sheet, /desktopPresentation = "sheet"/);
  assert.match(sheet, /data-desktop-presentation=\{desktopPresentation\}/);
  assert.match(css, /@media \(min-width: 768px\) \{\s*\.klasse-portal-theme\.klasse-context-sheet\[data-desktop-presentation="centered"\]\s*\{\s*inset: 0;\s*margin: auto;/);
  assert.match(fila, /<ModalShell open=\{open\}/);
  assert.doesNotMatch(fila, /fixed inset-0 z-50/);
  assert.match(shell, /layout="viewport"/);
});
