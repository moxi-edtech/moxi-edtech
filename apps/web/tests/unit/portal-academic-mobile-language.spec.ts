import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("mobile academic visual layer is scoped to student and teacher layouts", () => {
  const student = read("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  const teacher = read("components/professor/layout/ProfessorPortalLayout.tsx");
  const css = read("app/globals.css");
  for (const layout of [student, teacher]) assert.match(layout, /klasse-portal-theme klasse-academic-mobile/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /\.klasse-academic-mobile \.klasse-portal-tabs/);
  assert.match(css, /\.klasse-academic-mobile \.klasse-portal-operational-card/);
  assert.match(css, /\.klasse-portal-theme \.klasse-welcome-card/);
  assert.match(read("components/portal/ui/PortalTabs.tsx"), /aria-selected=\{value === tab.id\}/);
});

test("internal academic areas retain routes and semantic state while dropping decorative colors", () => {
  const schedule = read("components/aluno/tabs/TabHorario.tsx");
  const calendar = read("app/professor/calendario/page.tsx");
  assert.match(schedule, /aria-pressed=\{activeDay === dia.id\}/);
  assert.doesNotMatch(schedule, /bg-klasse-gold text-klasse-gold-900/);
  assert.doesNotMatch(calendar, /blur-3xl/);
  assert.match(calendar, /upcomingItems\.length/);
  assert.match(read("app/professor/notas/page.tsx"), /max-md:px-0 max-md:py-0/);
});
