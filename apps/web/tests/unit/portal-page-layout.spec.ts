import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isWidePortalPage,
  PORTAL_PAGE_INSET,
  PORTAL_PAGE_HORIZONTAL_INSET,
  PORTAL_PAGE_WIDE_INSET,
} from "../../src/lib/layout/portal-page";

const source = (file: string) =>
  readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");

test("single page inset preserves the reference from Alunos", () => {
  assert.match(PORTAL_PAGE_INSET, /max-w-6xl/);
  assert.match(PORTAL_PAGE_INSET, /px-6 py-8/);
  assert.match(PORTAL_PAGE_INSET, /min-w-0/);
  assert.match(
    source("components/escola-admin/AlunosListClient.tsx"),
    /max-w-6xl mx-auto px-6 py-8/,
  );
});

test("only the timetable canvas opts into the wider limit", () => {
  for (const path of [
    "/escola/curtume/horarios/quadro",
    "/escola/curtume/operacoes/horarios/quadro",
    "/horarios/quadro",
  ]) assert.equal(isWidePortalPage(path), true, path);

  for (const path of [
    "/escola/curtume/operacoes/alunos",
    "/escola/curtume/operacoes/configuracoes",
    "/escola/curtume/operacoes/horarios/slots",
    "/escola/curtume/operacoes/horarios/quadro-alternativo",
    "/escola/curtume/financeiro/recebimentos",
    "",
  ]) assert.equal(isWidePortalPage(path), false, path);

  assert.match(PORTAL_PAGE_WIDE_INSET, /max-w-7xl/);
  assert.match(PORTAL_PAGE_HORIZONTAL_INSET, /max-w-6xl px-6/);
});

test("AppShell preserves print bypass and route-aware timetable width", () => {
  const shell = source("components/layout/klasse/AppShell.tsx");
  assert.match(shell, /if \(isPrintView\)/);
  assert.match(shell, /isWidePortalPage\(safePathname\)/);
  assert.match(shell, /isWidePage \? "max-w-7xl" : "max-w-6xl"/);
});

test("principal operational pages use the same inset", () => {
  const standardized = [
    "components/layout/operacoes/OperacoesDashboard.tsx",
    "components/layout/escola-admin/EscolaAdminDashboard.tsx",
    "components/escola/settings/SettingsHub.tsx",
    "components/escola/settings/ConfigSystemShell.tsx",
    "components/secretaria/TurmasListClient.tsx",
    "components/secretaria/ClassesListClient.tsx",
    "components/secretaria/SecretariaDocumentosWorkspace.tsx",
    "components/academico/CalendarioAvaliacoesClient.tsx",
    "app/escola/[id]/(portal)/financeiro/controle-caixa/page.tsx",
    "app/escola/[id]/(portal)/financeiro/recebimentos/page.tsx",
    "app/escola/[id]/(portal)/financeiro/cobrancas/page.tsx",
    "app/escola/[id]/(portal)/financeiro/radar/page.tsx",
    "app/escola/[id]/(portal)/admin/notas/page.tsx",
    "app/escola/[id]/(portal)/admin/relatorios/page.tsx",
    "app/secretaria/(portal-secretaria)/Dashboard.tsx",
    "app/secretaria/(portal-secretaria)/admissoes/page.tsx",
  ];
  for (const file of standardized) {
    assert.match(source(file), /PORTAL_PAGE_INSET/, file);
  }
  for (const file of [
    "app/escola/[id]/(portal)/professores/page.tsx",
    "app/secretaria/(portal-secretaria)/rematricula/page.tsx",
    "app/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx",
    "app/escola/[id]/(portal)/financeiro/configuracoes/precos/page.tsx",
    "app/escola/[id]/(portal)/financeiro/relatorios/detalhados/page.tsx",
    "app/escola/[id]/(portal)/admin/avisos/novo/page.tsx",
  ]) assert.match(source(file), /PORTAL_PAGE_INSET/, file);

  const turma = source("components/secretaria/TurmaDetailClient.tsx");
  assert.equal((turma.match(/PORTAL_PAGE_HORIZONTAL_INSET/g) ?? []).length, 4);
  assert.doesNotMatch(turma, /max-w-7xl mx-auto px-6/);

  const configShell = source("components/escola/settings/ConfigSystemShell.tsx");
  assert.match(configShell, /embedded \? "h-full w-full min-w-0 space-y-6"/);
  assert.match(configShell, /\: `\$\{PORTAL_PAGE_INSET\} space-y-6`/);

  const auditReport = source("app/escola/[id]/(portal)/financeiro/relatorios/detalhados/page.tsx");
  assert.match(auditReport, /overflow-x-auto/);

  const notices = source("app/escola/[id]/(portal)/admin/avisos/novo/page.tsx");
  assert.match(notices, /<header className="max-w-3xl">/);
  assert.match(notices, /className="max-w-3xl rounded-xl/);

  assert.doesNotMatch(
    source("components/layout/escola-admin/EscolaAdminDashboard.tsx"),
    /min-\[1700px\]:p-8/,
  );
});

test("Secretaria and Admin module content follows the shared school gutter", () => {
  const fullPageModules = [
    "app/secretaria/(portal-secretaria)/exportacoes/page.tsx",
    "app/secretaria/(portal-secretaria)/importacoes/page.tsx",
    "app/secretaria/(portal-secretaria)/importacoes/[id]/page.tsx",
    "app/secretaria/(portal-secretaria)/admissoes/nova/page.tsx",
    "app/secretaria/(portal-secretaria)/alertas/page.tsx",
    "app/secretaria/(portal-secretaria)/acesso-alunos/page.tsx",
    "app/secretaria/(portal-secretaria)/calendario/page.tsx",
    "app/secretaria/(portal-secretaria)/fecho/page.tsx",
    "app/secretaria/(portal-secretaria)/fechamento-academico/page.tsx",
    "app/secretaria/(portal-secretaria)/fechamento-academico/sanidade/page.tsx",
    "app/secretaria/(portal-secretaria)/fechamento-academico/cockpit/page.tsx",
    "app/secretaria/(portal-secretaria)/notas/page.tsx",
    "app/secretaria/(portal-secretaria)/operacoes-academicas/page.tsx",
    "app/secretaria/(portal-secretaria)/operacoes-academicas/reclassificacao-finalistas/page.tsx",
    "app/secretaria/(portal-secretaria)/operacoes-academicas/reconciliacao-historica/page.tsx",
    "app/secretaria/(portal-secretaria)/rematricula/confirmar/page.tsx",
    "app/secretaria/(portal-secretaria)/rematricula/reconciliacao/page.tsx",
    "app/secretaria/(portal-secretaria)/relatorios/page.tsx",
    "app/secretaria/(portal-secretaria)/raa/dependencias/page.tsx",
    "app/secretaria/(portal-secretaria)/raa/indisciplina/page.tsx",
    "app/secretaria/(portal-secretaria)/raa/reapreciacoes/page.tsx",
    "app/secretaria/(portal-secretaria)/migracao/historico/page.tsx",
    "app/secretaria/(portal-secretaria)/migracao/alunos/page.tsx",
    "app/secretaria/(portal-secretaria)/fluxo-academico/page.tsx",
    "app/secretaria/(portal-secretaria)/candidaturas/[id]/editar/page.tsx",
    "app/secretaria/(portal-secretaria)/alunos/[id]/editar/page.tsx",
    "app/secretaria/(portal-secretaria)/relatorios/mapa-aproveitamento/ui.tsx",
    "components/secretaria/PagamentosPendentesWindow.tsx",
    "app/escola/[id]/(portal)/admin/ai/KlasseAiCockpitClient.tsx",
    "app/escola/[id]/(portal)/admin/ai/actions/AiActionsCenterClient.tsx",
    "app/escola/[id]/(portal)/admin/operacoes-academicas/wizard/page.tsx",
    "app/escola/[id]/(portal)/admin/configuracoes/avaliacao-frequencia/page.tsx",
    "components/secretaria/DocumentosOficiaisBatchClient.tsx",
    "components/secretaria/OcupacaoClient.tsx",
    "components/secretaria/ProfessoresListClient.tsx",
    "components/secretaria/ClasseDetailClient.tsx",
    "components/secretaria/MigracaoPautasPage.tsx",
  ];

  for (const file of fullPageModules) {
    assert.match(source(file), /PORTAL_PAGE_INSET/, file);
  }

  const adminSettings = source("app/escola/[id]/(portal)/admin/configuracoes/page.tsx");
  assert.match(adminSettings, /PORTAL_PAGE_HORIZONTAL_INSET/);
  assert.doesNotMatch(adminSettings, /max-w-6xl mx-auto pt-6 px-6/);
  assert.doesNotMatch(adminSettings, /bg-muted min-h-screen/);

  const migration = source("components/secretaria/MigracaoPautasPage.tsx");
  assert.doesNotMatch(migration, /max-w-\[1600px\]/);
  const edits = source("app/secretaria/(portal-secretaria)/alunos/[id]/editar/page.tsx");
  assert.match(edits, /PORTAL_PAGE_HORIZONTAL_INSET/);
  assert.doesNotMatch(edits, /max-w-5xl mx-auto px-4/);
});

test("delegated Secretaria headers align without adding an extra page inset to their clients", () => {
  const headerDelegates = [
    "alunos/page.tsx",
    "alunos/[id]/page.tsx",
    "classes/page.tsx",
    "classes/[id]/page.tsx",
    "turmas/page.tsx",
    "turmas/[id]/page.tsx",
    "turmas/ocupacao/page.tsx",
    "professores/page.tsx",
    "documentos-oficiais/page.tsx",
    "documentos/page.tsx",
    "recebimentos/page.tsx",
    "relatorios/mapa-aproveitamento/page.tsx",
  ];
  for (const name of headerDelegates) {
    const file = `app/secretaria/(portal-secretaria)/${name}`;
    const contents = source(file);
    assert.match(contents, /PORTAL_PAGE_HORIZONTAL_INSET/, file);
    assert.equal((contents.match(/import \{ PORTAL_PAGE_HORIZONTAL_INSET \} from/g) ?? []).length, 1, `duplicate portal inset import in ${file}`);
    assert.doesNotMatch(contents, /PORTAL_PAGE_INSET/, `Nested page inset in ${file}`);
  }
});
