import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("chamada conserva todos os estados e dá prioridade ao nome no mobile", () => {
  const page = source("app/professor/frequencias/page.tsx");
  const students = page.split("{filteredAlunos.map((a) => {")[1] ?? "";
  assert.match(page, /const studentNumbers = useMemo/);
  assert.match(students, /min-w-0 flex-1 break-words/);
  assert.match(students, /role="group"/);
  assert.match(students, /grid grid-cols-3/);
  for (const value of ["presente", "falta", "atraso"]) {
    assert.match(students, new RegExp("value: '" + value + "'"));
  }
  assert.match(students, /aria-pressed=\{active\}/);
  assert.match(students, /setSubmitStatus\('idle'\)/);
});

test("desistência continua disponível, mas só monta após opção explícita", () => {
  const page = source("app/professor/frequencias/page.tsx");
  const students = page.split("{filteredAlunos.map((a) => {")[1] ?? "";
  assert.match(students, /setOpenActionsId/);
  assert.match(students, /Outras ações para/);
  assert.match(students, /a\.matriculaId && turmaId && actionsOpen &&/);
  assert.match(students, /<DesistenciaMatriculaAction variant="menu" tipo="sinalizar"/);
  assert.match(students, /matriculaId=\{a\.matriculaId\}/);
  assert.doesNotMatch(students, /Sinalizar desistência<\/button>/);
});

test("plano de aula usa skeleton com a anatomia do cartão, não duas barras genéricas", () => {
  const plan = source("app/professor/planos-aula/page.tsx");
  const skeleton = source("components/professor/ProfessorLoadingSkeletons.tsx");
  assert.match(plan, /<ProfessorLessonPlansListSkeleton \/>/);
  assert.match(plan, /<ProfessorSkeletonBone className="h-11 w-full rounded-xl/);
  assert.match(plan, /loading && assignments\.length === 0/);
  assert.match(plan, /disabled=\{loading \|\| Boolean\(loadError\)\}/);
  assert.match(skeleton, /export function ProfessorLessonPlansListSkeleton\(/);
  assert.match(skeleton, /h-5 w-16 rounded-full/);
  assert.match(skeleton, /h-8 w-8 rounded-xl/);
  assert.doesNotMatch(plan, /h-16 rounded-xl bg-slate-100/);
});
