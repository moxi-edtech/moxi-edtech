import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { visibleSearchResults } from "../../src/lib/command-center/search-visibility";
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
  assert.match(palette, /onStudentSelect\(\{ id: item\.id, label: item\.label \}\)/);
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

test("staff search excludes academic login rows but preserves academic entities", () => {
  const rows = [
    { id: "student-auth", type: "usuario", highlight: "Aluno" },
    { id: "teacher-auth", type: "usuario", highlight: " professor " },
    { id: "academic-student", type: "aluno", highlight: "000004" },
    { id: "academic-teacher", type: "professor", highlight: null },
    { id: "staff-user", type: "usuario", highlight: "secretaria" },
    { id: "school-admin", type: "usuario", highlight: "admin_escola" },
  ];
  for (const portal of ["operacoes", "admin"]) {
    assert.deepEqual(visibleSearchResults(rows, portal).map(row => row.id),
      ["academic-student", "academic-teacher", "staff-user", "school-admin"]);
  }
  assert.equal(visibleSearchResults(rows, "superadmin").length, rows.length,
    "Global admin account management keeps its own user access listing");
  assert.equal(visibleSearchResults(rows, "secretaria").length, rows.length,
    "Secretaria does not include usuario among its RPC search types");
});

test("all live, cached, fallback and paginated search results use the same visibility rule", () => {
  const source = readFileSync(new URL("../../src/hooks/useGlobalSearch.ts", import.meta.url), "utf8");
  assert.match(source, /admin: \["aluno",/);
  assert.match(source, /operacoes: \["aluno",/);
  assert.equal((source.match(/visibleSearchResults\(/g) ?? []).length, 5);
  assert.match(source, /case "usuario":\s*return buildPortalHref\(escolaParam, "\/admin\/funcionarios"\)/);
});
