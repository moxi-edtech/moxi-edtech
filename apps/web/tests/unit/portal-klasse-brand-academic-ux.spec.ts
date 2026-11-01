import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("cores KLASSE apenas nos portais, sem alterar tema global", async () => {
  const css = await read("app/globals.css");
  const aluno = await read("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  const professor = await read("components/professor/layout/ProfessorPortalLayout.tsx");
  assert.match(css, /\.klasse-portal-theme \{/);
  assert.match(css, /--primary: #1f6b3b/);
  assert.match(css, /\.klasse-portal-cta/);
  assert.match(css, /background-color: #e3b23c/);
  assert.match(aluno, /klasse-portal-theme/);
  assert.match(professor, /klasse-portal-theme/);
});

test("navegação e área académica explicitam contexto sem inventar estado", async () => {
  const [academic, tabs, alunoNav, profNav] = await Promise.all([
    read("components/aluno/academico/AcademicoWorkspace.tsx"),
    read("components/portal/ui/PortalTabs.tsx"),
    read("components/aluno/layout/AlunoBottomNav.tsx"),
    read("components/professor/layout/ProfessorBottomNav.tsx"),
  ]);
  assert.match(academic, /descriptions\[activeTab\]/);
  assert.match(academic, /<PortalTabs items=\{sections\}/);
  assert.match(tabs, /border-klasse-gold/);
  assert.match(alunoNav, /klasse-gold/);
  assert.match(profNav, /klasse-gold/);
});

test("notas e decisões técnicas conservam ações sem poluir a interface", async () => {
  const [alunoNotas, professorNotas, grade] = await Promise.all([
    read("components/aluno/tabs/TabNotas.tsx"),
    read("app/professor/notas/page.tsx"),
    read("components/aluno/academico/BoletimGradeGrid.tsx"),
  ]);
  assert.match(alunoNotas, /klasse-portal-cta/);
  assert.match(alunoNotas, /safeIsLiberado/);
  assert.match(professorNotas, /<details className="mt-3/);
  assert.match(professorNotas, /Ver critérios do resultado/);
  assert.match(professorNotas, /Alunos que precisam de atenção/);
  assert.match(grade, /locked \? \[\] : subject\.avaliacoes/);
});

test("horário: eventos vêm do calendário real, sem datas inventadas", async () => {
  const horario = await read("components/aluno/tabs/TabHorario.tsx");
  assert.match(horario, /\/api\/aluno\/home\/academic-events/);
  assert.match(horario, /ano_letivo_id/);
  assert.match(horario, /studentId/);
  assert.match(horario, /agendaError/);
  assert.match(horario, /Horário ainda não publicado/);
  assert.doesNotMatch(horario, /avaliacoesMock|2026-08-14|2026-08-18/);
});

test("dashboards não apresentam progresso fictício", async () => {
  const [principal, home] = await Promise.all([
    read("components/aluno/dashboard/DashboardLoader.tsx"),
    read("components/aluno/tabs/TabHome.tsx"),
  ]);
  assert.match(principal, /bg-klasse-green/);
  assert.match(home, /Média recente/);
  assert.match(home, /mediaNotas === null/);
  assert.doesNotMatch(home, /\+0\.2|Meta: 90%/);
});
