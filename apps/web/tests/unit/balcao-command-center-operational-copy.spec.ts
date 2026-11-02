import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("explorer roster offers working filters without a compliance lecture or disabled placeholder", () => {
  const ui = source("components/secretaria/command-center/ExplorerRosterControls.tsx");
  assert.match(ui, /id="cc-roster-filter-note" className="sr-only"/);
  assert.match(ui, /option value="documentos_sinalizados"/);
  assert.match(ui, /option value="propinas_vencidas"/);
  assert.doesNotMatch(ui, /value="matricula_incompleta" disabled/);
  assert.doesNotMatch(ui, /A ordenação é aplicada antes da paginação/);
});

test("export retains a personal-data confirmation but hides permanent auditing prose", () => {
  const ui = source("components/secretaria/command-center/ExplorerRosterExportButton.tsx");
  assert.match(ui, /window\.confirm\(/);
  assert.match(ui, /O ficheiro contém dados pessoais/);
  assert.doesNotMatch(ui, /Exige autorização por escola e auditoria registada/);
  assert.match(ui, /\/command-center\/roster\/export/);
});

test("technical Balcão codes are available to support only after disclosure", () => {
  const ui = source("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(ui, /function CodigoEstado/);
  assert.match(ui, /<details className="mt-2 text-\[11px\] text-amber-900">/);
  assert.match(ui, /Detalhes para suporte/);
  assert.match(ui, /<code className=/);
  assert.match(ui, /Sem nova cobrança/);
  assert.match(ui, /onResolverReconciliacao/);
  assert.match(ui, /onCancelPendingPedido/);
});

test("command center shows student context instead of redundant module descriptions", () => {
  const shell = source("components/secretaria/command-center/CommandCenterShell.tsx");
  const panel = source("components/secretaria/command-center/CommandCenterPanel.tsx");
  assert.match(shell, /studentSubtitle/);
  assert.doesNotMatch(shell, /action\.description/);
  assert.doesNotMatch(panel, /Consulte dados pessoais, financeiro, histórico académico e documentos no mesmo atendimento/);
  const dossier = source("components/secretaria/command-center/CommandCenterStudentDossier.tsx");
  assert.match(dossier, /\(loading \|\| error\) &&/);
  assert.match(dossier, /inert=\{notConfirmed\}/);
});

test("explorers retain important incomplete-data states but hide explanatory duplication", () => {
  const grade = source("components/secretaria/command-center/ClasseContextView.tsx");
  const course = source("components/secretaria/command-center/CourseContextView.tsx");
  const turma = source("components/secretaria/command-center/TurmaContextView.tsx");
  const teacher = source("components/secretaria/command-center/ProfessorContextView.tsx");
  const discipline = source("components/secretaria/command-center/DisciplinaContextView.tsx");
  const historic = source("components/secretaria/command-center/ExplorerHistoricalScopeNotice.tsx");
  assert.match(grade, /Dados parciais/);
  assert.match(discipline, /Dados parciais/);
  assert.match(teacher, /Dados parciais/);
  assert.match(course, /Descrição do curso/);
  assert.match(turma, /Lista parcial de disciplinas/);
  assert.match(historic, /Pesquisa e exportação indisponíveis/);
  assert.doesNotMatch(grade, /Matriz curricular é referência/);
  assert.doesNotMatch(teacher, /Disciplinas atribuídas a este professor no ano selecionado/);
});

test("student actions rely on the existing authorization API, not a visible permission lecture", () => {
  const ui = source("components/secretaria/command-center/ExplorerStudentActions.tsx");
  assert.match(ui, /\/student-capabilities\?/);
  assert.match(ui, /disabled=\{!available\}/);
  assert.doesNotMatch(ui, /Cada módulo confirma novamente a permissão/);
});
