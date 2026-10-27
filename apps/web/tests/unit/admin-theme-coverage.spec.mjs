import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const load = path => readFileSync(new URL(`../../src/components/${path}`, import.meta.url), "utf8");

const themedSurfaces = [
  "financeiro/RegistoPagamentoModal.tsx",
  "financeiro/GerarMensalidadesModal.tsx",
  "financeiro/PagamentosListClient.tsx",
  "financeiro/TabelasMensalidadeClient.tsx",
  "financeiro/FilaValidacaoPagamentos.tsx",
  "layout/escola-admin/EscolaAdminDashboardContent.tsx",
  "layout/escola-admin/QuickActionsSection.tsx",
  "layout/escola-admin/AcademicSection.tsx",
  "layout/escola-admin/ChartsSection.tsx",
  "layout/escola-admin/OperationalFeedSection.tsx",
  "layout/operacoes/AulasOperacionaisPanel.tsx",
  "layout/operacoes/NotasReaberturaPanel.tsx",
  "layout/operacoes/PlanosAulaReviewPanel.tsx",
  "super-admin/SchoolsSection.tsx",
  "super-admin/escolas/SchoolsTable.tsx",
  "super-admin/escolas/SchoolsFilters.tsx",
  "super-admin/UsuariosListClient.tsx",
  "super-admin/ConfirmActionModal.tsx",
  "super-admin/SchoolBillingModal.tsx",
];

test("administrative surfaces use theme-aware neutral backgrounds and text", () => {
  for (const path of themedSurfaces) {
    const component = load(path);
    assert.doesNotMatch(component, /\bbg-white(?:\/\d+)?(?![\w/-])/, path);
    assert.doesNotMatch(component, /\btext-(?:slate|gray)-(?:800|900|950)(?![\w/-])/, path);
    assert.doesNotMatch(component, /\bborder-(?:slate|gray)-(?:100|200|300)(?![\w/-])/, path);
  }
});

test("administrative payments and destructive dialogs remain usable on small viewports", () => {
  for (const path of [
    "financeiro/GerarMensalidadesModal.tsx",
    "financeiro/TabelasMensalidadeClient.tsx",
    "super-admin/ConfirmActionModal.tsx",
    "super-admin/SchoolBillingModal.tsx",
  ]) {
    const component = load(path);
    assert.match(component, /max-h-\[calc\(100dvh-2rem\)\]/, path);
    assert.match(component, /overflow-y-auto/, path);
  }
  for (const path of ["super-admin/ConfirmActionModal.tsx", "super-admin/SchoolBillingModal.tsx"]) {
    assert.match(load(path), /aria-modal="true"/, path);
  }
});

test("admin charts use semantic axis and grid colors", () => {
  const component = load("layout/escola-admin/ChartsSection.tsx");
  assert.match(component, /SLATE_TICK\s*=\s*"var\(--muted-foreground\)"/);
  assert.match(component, /SLATE_GRID\s*=\s*"var\(--border\)"/);
});

test("financial inputs remain labeled and distinguishable from the surrounding modal", () => {
  for (const id of ["billing-amount", "billing-due-date"]) {
    assert.match(load("super-admin/SchoolBillingModal.tsx"), new RegExp(`htmlFor="${id}"`));
    assert.match(load("super-admin/SchoolBillingModal.tsx"), new RegExp(`id="${id}"`));
  }
  assert.match(load("financeiro/RegistoPagamentoModal.tsx"), /htmlFor="pagamento-metodo"/);
  assert.match(load("financeiro/RegistoPagamentoModal.tsx"), /bg-background text-foreground/);
});
