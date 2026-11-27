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
  const activity = source("components/secretaria/MinhaProdutividade.tsx");
  const hub = source("components/layout/operacoes/OperacoesPainelHub.tsx");
  const queue = dashboard.indexOf("<OperacoesPainelHub escolaId={escolaId} onlyReopen inlineReopen");
  assert.ok(queue > dashboard.indexOf('aria-labelledby="secretaria-caixa-title"'));
  assert.ok(queue < dashboard.indexOf('aria-labelledby="secretaria-atendimento-title"'));
  assert.equal((dashboard.match(/<OperacoesPainelHub\b/g) ?? []).length, 1);
  assert.doesNotMatch(dashboard, /RadarOperacional|showSignature=\{false\}/);
  assert.doesNotMatch(cash, /Pagamentos parciais|showPartialPayments/);
  assert.doesNotMatch(activity, /Minhas admissões/);
  assert.match(activity, /Fichas incompletas/);
  assert.match(dashboard, /Matrículas de hoje/);
  assert.match(hub, /const embeddedReopen = onlyReopen && inlineReopen/);
  assert.match(hub, /if \(onlyReopen && !authorized\) return null/);
});
