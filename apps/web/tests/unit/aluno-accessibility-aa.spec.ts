import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path: string) {
  return readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");
}

test("academic tabs implement roving focus, arrow keys, Home/End and stable accessible panels", async () => {
  const s = await source("components/aluno/academico/AcademicoWorkspace.tsx");
  const tabs = await source("components/portal/ui/PortalTabs.tsx");
  assert.match(tabs, /event\.key === "ArrowRight"/);
  assert.match(tabs, /event\.key === "ArrowLeft"/);
  assert.match(tabs, /event\.key === "Home"/);
  assert.match(tabs, /event\.key === "End"/);
  assert.match(tabs, /event\.preventDefault\(\)/);
  assert.match(tabs, /tabIndex=\{value === tab.id \? 0 : -1\}/);
  assert.match(tabs, /refs\.current\[value\]\?\.focus\(\)/);
  assert.match(tabs, /onKeyDown=\{\(event\) => onTabKeyDown\(event, tab.id\)\}/);
  for (const tab of ["notas", "disciplinas", "documentos"]) {
    assert.match(s, new RegExp('id="academic-panel-' + tab + '"'));
    assert.match(s, new RegExp('aria-labelledby="academic-tab-' + tab + '"'));
  }
  assert.match(s, /window\.history\.pushState/);
  assert.match(s, /window\.addEventListener\("popstate"/);
});

test("academic grade modals trap and restore focus with Radix; actions and fields are labelled", async () => {
  const s = await source("components/aluno/tabs/TabNotas.tsx");
  assert.match(s, /Dialog, DialogContent, DialogDescription, DialogTitle/);
  assert.equal((s.match(/<Dialog open onOpenChange=/g) ?? []).length, 2);
  assert.equal((s.match(/onCloseAutoFocus=\{restoreDialogFocus\}/g) ?? []).length, 2);
  assert.match(s, /dialogOpener\.current\?\.focus\(\)/);
  assert.match(s, /dialogOpener\.current = document\.activeElement/);
  assert.match(s, /<DialogTitle>Solicitar reapreciação/);
  assert.match(s, /<DialogTitle>Solicitar melhoria/);
  assert.match(s, /htmlFor="aluno-raa-motivo"/);
  assert.match(s, /id="aluno-raa-motivo"/);
  assert.match(s, /htmlFor="aluno-melhoria-sessao"/);
  assert.match(s, /id="aluno-melhoria-sessao"/);
  assert.match(s, /htmlFor="aluno-melhoria-motivo"/);
  assert.match(s, /id="aluno-melhoria-motivo"/);
  assert.doesNotMatch(s, /role="dialog" aria-modal="true"/);
});

test("mobile interactive targets have at least 44px, theme-aware foregrounds and visible focus", async () => {
  const [notes, docs, dash, disciplines] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/tabs/TabDocumentos.tsx"),
    source("components/aluno/dashboard/DashboardLoader.tsx"),
    source("components/aluno/disciplinas/DisciplinasList.tsx"),
  ]);
  assert.match(notes, /inline-flex min-h-11 items-center gap-1\.5 px-1 text-sm/);
  assert.match(dash, /<PortalAction href=\{go\(item.href\)\}/);
  const portalAction = await source("components/portal/ui/PortalAction.tsx");
  assert.match(docs, /<PortalAction onClick=\{\(\) => void handleAction\(doc\)\}/);
  assert.match(portalAction, /inline-flex min-h-11/);
  assert.match(disciplines, /inline-flex min-h-11 items-center gap-2/);
  for (const file of [notes, dash, disciplines, portalAction]) assert.match(file, /focus-visible:ring-(2|ring)/);
  assert.match(dash, /text-primary/);
  assert.match(notes, /text-primary/);
});

test("screen reader loading status is announced without reading skeleton decorations", async () => {
  const [notes, dashboard, disciplines] = await Promise.all([
    source("components/aluno/tabs/TabNotas.tsx"),
    source("components/aluno/dashboard/DashboardLoader.tsx"),
    source("components/aluno/disciplinas/DisciplinasList.tsx"),
  ]);
  for (const item of [notes, dashboard, disciplines]) {
    assert.match(item, /role="status"/);
    assert.match(item, /aria-live="polite"/);
    assert.match(item, /className="sr-only"/);
    assert.match(item, /aria-hidden="true"/);
  }
});
