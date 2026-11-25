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
  assert.doesNotMatch(academic, /descriptions\[activeTab\]/);
  assert.match(academic, /layout="compact"/);
  assert.match(tabs, /grid grid-cols-4/);
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

test("portal do aluno compacta cabeçalho, dashboard e notas sem perder ações", async () => {
  const [header, dashboard, grid, notas, layout] = await Promise.all([
    read("components/aluno/layout/AlunoHeader.tsx"),
    read("components/aluno/dashboard/DashboardLoader.tsx"),
    read("components/aluno/academico/BoletimGradeGrid.tsx"),
    read("components/aluno/tabs/TabNotas.tsx"),
    read("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx"),
  ]);
  assert.match(header, /<details className="group relative">/);
  assert.match(header, /<SignOutButton/);
  assert.match(dashboard, /AcaoRapidaCard dashboardCompact mobileCompact/);
  assert.doesNotMatch(dashboard, /O que precisas de saber hoje|id="school-links"/);
  assert.match(dashboard, /status_financeiro\.pendentes > 0/);
  assert.match(grid, /disabled=\{locked \|\| downloading \|\| !canDownloadOfficial\}/);
  assert.doesNotMatch(notas, /embedded && academicYear !== null/);
  assert.match(layout, /pb-\[calc\(88px\+env\(safe-area-inset-bottom\)\)\]/);
});

test("aluno reutiliza os cards de Operações com densidade mobile, sem retirar os links", async () => {
  const [dashboard, quick, card] = await Promise.all([
    read("components/aluno/dashboard/DashboardLoader.tsx"),
    read("components/layout/escola-admin/QuickActionsSection.tsx"),
    read("components/shared/AcaoRapidaCard.tsx"),
  ]);
  assert.match(quick, /import AcaoRapidaCard from "@\/components\/shared\/AcaoRapidaCard"/);
  assert.match(dashboard, /import AcaoRapidaCard from "@\/components\/shared\/AcaoRapidaCard"/);
  assert.match(dashboard, /grid-cols-1 gap-2 md:grid-cols-3/);
  assert.match(card, /mobileCompact = false/);
  assert.match(card, /unavailable: disabled \|\| unavailable/);
  assert.match(card, /min-h-16[^"]*bg-card p-3/);
  assert.match(card, /min-h-\[88px\][^"]*bg-card p-4/);
  assert.match(card, /if \(href\) return <Link href=\{href\}/);
  assert.match(dashboard, /href=\{go\("\/aluno\/horario"\)\}/);
  assert.match(dashboard, /href=\{go\(item.href\)\}/);
  assert.doesNotMatch(dashboard, /<PortalStatCard/);
});
