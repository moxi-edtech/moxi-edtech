import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isWidePortalPage,
  PORTAL_PAGE_INSET,
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
  assert.doesNotMatch(
    source("components/layout/escola-admin/EscolaAdminDashboard.tsx"),
    /min-\[1700px\]:p-8/,
  );
});
