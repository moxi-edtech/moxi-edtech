import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
test("attendance rows keep a stable number during search and make actions discoverable", () => {
  const code = read("components/professor/ProfessorFrequenciasWorkspace.tsx");
  assert.match(code, /new Map\(alunos\.map\(\(student, index\)/);
  assert.match(code, /studentNumbers\.get\(a\.id\)/);
  assert.match(code, /grid grid-cols-3/);
  assert.match(code, /role="group"/);
  assert.match(code, /aria-pressed=\{active\}/);
  assert.match(code, /aria-expanded=\{actionsOpen\}/);
  assert.match(code, /setOpenActionsId/);
  assert.match(code, /DesistenciaMatriculaAction variant="menu"/);
  assert.match(code, /setSubmitStatus\('idle'\)/);
  assert.doesNotMatch(code, /<DesistenciaMatriculaAction tipo="sinalizar"/);
});

test("plan-list skeleton matches the title/date/status/edit anatomy of real cards", () => {
  const skeleton = read("components/professor/ProfessorLoadingSkeletons.tsx");
  const plans = read("components/professor/ProfessorPlanosWorkspace.tsx");
  assert.match(plans, /ProfessorPlanosListSkeleton/);
  const start = skeleton.indexOf("export function ProfessorPlanosListSkeleton()");
  const end = skeleton.indexOf("/** Layout-equivalent", start);
  assert.ok(start >= 0 && end > start);
  const block = skeleton.slice(start, end);
  assert.match(block, /aria-busy="true"/);
  assert.match(block, /h-6 w-16 rounded-full/);
  assert.match(block, /h-9 w-9 rounded-xl/);
  assert.match(block, /h-4 w-3\/4/);
});
