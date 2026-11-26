import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("portais académicos usam o símbolo oficial e mantêm os controlos existentes", () => {
  const aluno = read("components/aluno/layout/AlunoHeader.tsx");
  const topbar = read("components/layout/klasse/Topbar.tsx");
  for (const source of [aluno, topbar]) assert.match(source, /src="\/logo-klasse-ui\.png"/);
  assert.match(topbar, /academicPortal = portal === "aluno" \|\| portal === "professor"/);
  assert.match(topbar, /<NotificacoesDropdown/);
  assert.match(topbar, /<CommandPalette/);
  assert.match(aluno, /onSelectAluno\(event\.target\.value\)/);
});

test("navegação verde e atalhos discretos, sem alterar tons operacionais padrão", () => {
  const nav = read("components/layout/klasse/PortalBottomNav.tsx");
  const quick = read("components/shared/AcaoRapidaCard.tsx");
  for (const path of ["components/aluno/dashboard/DashboardLoader.tsx", "app/professor/page.tsx"]) {
    const source = read(path);
    assert.match(source, /space-y-6/);
    assert.match(source, /portalTile portalClean/);
  }
  assert.match(nav, /bg-accent text-accent-foreground/);
  assert.doesNotMatch(nav, /bg-klasse-gold-50/);
  assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(quick, /portalClean = false/);
  assert.match(quick, /operationalCardIconClasses\[tone\]/);
});
