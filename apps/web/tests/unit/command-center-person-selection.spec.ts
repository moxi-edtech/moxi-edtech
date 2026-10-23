import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  resolveCommandCenterSelection,
  isCommandCenterOperatorPortal,
} from "../../src/lib/command-center/person-selection";

const palette = readFileSync(new URL("../../src/components/CommandPalette.tsx", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../../src/components/layout/klasse/Topbar.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../src/components/secretaria/command-center/CommandCenterShell.tsx", import.meta.url), "utf8");
const classe = readFileSync(new URL("../../src/components/secretaria/command-center/ClasseContextView.tsx", import.meta.url), "utf8");
const turma = readFileSync(new URL("../../src/components/secretaria/command-center/TurmaContextView.tsx", import.meta.url), "utf8");
const professor = readFileSync(new URL("../../src/components/secretaria/command-center/ProfessorContextView.tsx", import.meta.url), "utf8");

test("professor search and nested teacher names target one contextual modal", () => {
  for (const portal of ["secretaria", "operacoes", "admin"]) {
    assert.equal(resolveCommandCenterSelection("professor", portal, { hasSchoolScope: true, hasStudentModal: true }), "context");
    assert.ok(isCommandCenterOperatorPortal(portal));
  }
  assert.match(palette, /setEntityContext\(context\)/);
  assert.match(palette, /setOpen\(true\)/);
  assert.match(palette, /<ProfessorContextView context=\{entityContext\}/);
  assert.match(classe, /onClick=\{\(\) => open\(professor, onExploreProfessor\)\}/);
  assert.match(turma, /onExploreProfessor\(\{/);
  assert.match(professor, /Professor · \{context\.label\}/);
});

test("students from global search, class, and turma open existing Balcao as a modal", () => {
  for (const portal of ["secretaria", "operacoes", "admin"]) {
    assert.equal(resolveCommandCenterSelection("aluno", portal, { hasSchoolScope: true, hasStudentModal: true }), "student-modal");
  }
  assert.match(palette, /selection === "student-modal"/);
  assert.match(palette, /saveExplorerReturnContext\(/);
  assert.match(palette, /handleOpenChange\(false\);\s*setQuery\(" "\)/.source ? /onStudentSelect\(\{ id: item\.id, label: item\.label \}\)/ : /onStudentSelect/);
  assert.match(classe, /onClick=\{\(\) => selectStudent/);
  assert.match(turma, /onClick=\{\(\) => selectStudent/);
  assert.match(topbar, /createPortal\(/);
  assert.match(topbar, /<BalcaoWorkspace/);
  assert.match(topbar, /document\.body/);
  assert.match(shell, /z-\[70\]/);
});

test("scope and limited portals never expose a school-wide modal", () => {
  for (const portal of ["financeiro", "professor", "aluno", "gestor", "superadmin", undefined]) {
    assert.equal(resolveCommandCenterSelection("aluno", portal, { hasSchoolScope: true, hasStudentModal: true }), "navigate");
    assert.equal(resolveCommandCenterSelection("professor", portal, { hasSchoolScope: true, hasStudentModal: true }), "navigate");
  }
  assert.equal(resolveCommandCenterSelection("aluno", "operacoes", { hasSchoolScope: false, hasStudentModal: true }), "navigate");
  assert.equal(resolveCommandCenterSelection("aluno", "operacoes", { hasSchoolScope: true, hasStudentModal: false }), "navigate");
  assert.equal(resolveCommandCenterSelection("professor", "operacoes", { hasSchoolScope: false, hasStudentModal: true }), "navigate");
});
