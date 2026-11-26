import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("aluno e professor partilham a identidade institucional sem novas consultas", () => {
  const student = read("components/aluno/dashboard/DashboardLoader.tsx");
  const teacher = read("app/professor/page.tsx");
  const welcome = read("components/portal/ui/PortalWelcomeCard.tsx");
  assert.match(student, /<PortalWelcomeCard role="aluno"/);
  assert.match(teacher, /<PortalWelcomeCard[\s\S]*?role="professor"/);
  assert.match(welcome, /Africa\/Luanda/);
  assert.match(welcome, /aria-hidden="true"/);
  assert.match(welcome, /break-words/);
  assert.doesNotMatch(welcome, /useEffect|useState|fetch\(|"use client"/);
  assert.match(teacher, /prefetch=\{false\} label="Provas"/);
});

test("assinatura estática e cores do crachá limitadas ao cartão", () => {
  const css = read("app/globals.css");
  const asset = readFileSync(new URL("../../public/icons/klasse-welcome-signature.svg", import.meta.url), "utf8");
  assert.match(css, /--welcome-amber: #fea513/);
  assert.match(css, /--welcome-forest: #124527/);
  assert.match(css, /background-repeat: repeat-x/);
  assert.match(asset, /viewBox="0 0 96 24"/);
  assert.doesNotMatch(asset, /<script|https?:\/\/(?!www\.w3\.org)/);
});

test("professor não mascara indicadores indisponíveis com zero", () => {
  const teacher = read("app/professor/page.tsx");
  assert.match(teacher, /pendenciasResumo\?\.avaliacoes_pendentes \?\? null/);
  assert.match(teacher, /pendenciasResumo\?\.faltas_a_lancar \?\? null/);
  assert.match(teacher, /Dados indisponíveis/);
  assert.doesNotMatch(teacher, /animate-ping|blur-3xl/);
});

test("saudação tem uma única data e a fonte local tem licença e pesos reais", () => {
  const welcome = read("components/portal/ui/PortalWelcomeCard.tsx");
  const css = read("app/globals.css");
  const layout = read("app/layout.tsx");
  assert.equal((welcome.match(/<time\b/g) ?? []).length, 1);
  assert.doesNotMatch(welcome, /shortFormatter|shortDate/);
  assert.match(css, /font-weight: 100 800/);
  assert.match(css, /sora-variable\.ttf/);
  assert.match(layout, /rel="preload" href="\/fonts\/sora-variable\.ttf"/);
  assert.doesNotMatch(layout, /userScalable: false|maximumScale: 1|fonts\.googleapis\.com/);
  assert.ok(readFileSync(new URL("../../public/fonts/sora-variable.ttf", import.meta.url)).length > 10000);
  assert.match(readFileSync(new URL("../../public/fonts/OFL-Sora.txt", import.meta.url), "utf8"), /SIL OPEN FONT LICENSE/i);
});

test("operations shares the cultural signature without changing academic authority or routes", () => {
  const banner = read("components/layout/escola-admin/EstadoVitalBanner.tsx");
  assert.match(banner, /<PortalCulturalSignature/);
  assert.match(banner, /if \(compact\)/);
  assert.match(banner, /Diário bloqueado/);
  assert.match(banner, /href=\{calendarHref\}/);
  assert.match(banner, /<PortalSheet open=\{eventOpen/);
  const css = read("app/globals.css");
  assert.match(css, /\.klasse-portal-theme \.klasse-welcome-card,\s*\.klasse-welcome-card\.klasse-operations-academic-card/);
  assert.match(css, /background-position: center top/);
  assert.match(css, /background-size: 80px 20px/);
  const calendar = read("components/professor/ProfessorCalendarWorkspace.tsx");
  assert.match(calendar, /selectedEvent = items\.find/);
  assert.match(calendar, /<PortalSheet open=\{eventOpen/);
  assert.match(calendar, /selectedEvent\.descricao/);
});

test("contextual financial actions use confirmed scope and an immutable upload selection", () => {
  const finance = read("components/aluno/tabs/TabFinanceiro.tsx");
  assert.match(finance, /loadedQuery === query/);
  assert.match(finance, /controller.signal.aborted \|\| activeRequest.current !== controller/);
  assert.match(finance, /draftFrom > draftTo/);
  assert.match(finance, /setPaymentRows\(items.map/);
  assert.match(finance, /paymentLock.current/);
  assert.match(finance, /<PortalSheet open=\{detailOpen/);
  assert.match(finance, /<PaymentDrawer/);
  const absences = read("components/aluno/tabs/TabFaltas.tsx");
  assert.match(absences, /scope === query \? data : null/);
  assert.match(absences, /inFlight.current/);
  assert.match(absences, /<PortalSheet open=\{detailOpen/);
  const notes = read("components/professor/ProfessorGradesWorkspace.tsx");
  assert.match(notes, /loadedPautaScope === raaScope/);
  assert.match(notes, /mostrarTrimestresInativos: showInactiveTerms/);
  assert.match(notes, /<PortalSheet open=\{raaOpen/);
  assert.match(notes, /<PortalSheet open=\{exportOpen/);
});

test("second round of sheets reuses authorized data without eager roster or timetable queries", () => {
  const professor = read("app/professor/page.tsx");
  const roster = read("components/professor/ProfessorTurmaRoster.tsx");
  const calendar = read("components/professor/ProfessorCalendarWorkspace.tsx");
  const dashboard = read("components/aluno/dashboard/DashboardLoader.tsx");
  const schedule = read("components/aluno/tabs/TabHorario.tsx");
  const grades = read("components/aluno/academico/BoletimGradeGrid.tsx");
  const notes = read("components/aluno/tabs/TabNotas.tsx");
  assert.match(professor, /<PortalDrawerNavigator[^>]*open=\{Boolean\(selectedTurma\)\}/);
  assert.ok(professor.includes("<ProfessorTurmaHorario turmaId={selectedTurma.id} embedded />"));
  assert.match(professor, /<PortalDrawerNavigator[^>]*open=\{Boolean\(selectedLesson\)\}/);
  assert.ok(professor.includes("content: selectedTurma && <>"));
  assert.ok(roster.includes("payload.turmaId !== turmaId"));
  assert.ok(roster.includes("return () => ctrl.abort()"));
  assert.ok(calendar.includes('item.tipo === "AVALIACAO_ESCOLAR" && item.data_fim < todayIso'));
  assert.ok(calendar.includes("<PortalSheet open={historyOpen}"));
  assert.ok(dashboard.includes("content: lessonOpen ? <>"));
  assert.ok(dashboard.includes("<TabHorario dailyOnly />"));
  assert.ok(dashboard.includes("content: <TabHorario />"));
  assert.ok(schedule.includes("resolvedRequestKey === requestKey"));
  assert.ok(grades.includes("const sheetOpen = Boolean(expandedId && sheetSubject && sheetTerm)"));
  assert.ok(grades.includes("avaliacoes: locked ? [] : subject.avaliacoes"));
  assert.ok(notes.includes("safeIsLiberado && !historicalRead && matriculaEncontrada"));
  assert.ok(notes.includes("academicStatusScope === bulletinQuery"));
});

test("drawer navigator mantém um único diálogo, isolamento por contexto e retorno à origem", () => {
  const navigator = read("components/portal/ui/PortalDrawerNavigator.tsx");
  const sheet = read("components/portal/ui/PortalSheet.tsx");
  const notices = read("components/aluno/tabs/TabNotificacoes.tsx");
  const timetable = read("components/professor/ProfessorTurmaHorario.tsx");
  const direct = read("app/professor/turmas/[turmaId]/horario/page.tsx");
  assert.equal(navigator.match(/<PortalSheet\b/g)?.length, 1);
  assert.match(navigator, /stack.rootId === root.id/);
  assert.match(navigator, /hidden=\{entries.length > 0\}/);
  assert.match(navigator, /entries.slice\(0, -1\)/);
  assert.match(navigator, /body.current.scrollTop = target\?\.top/);
  assert.match(navigator, /target.opener.focus/);
  assert.match(sheet, /onBack && <button/);
  assert.match(notices, /navigation.push\(/);
  assert.match(notices, /!navigation && <PortalSheet/);
  assert.match(timetable, /\/api\/professor\/turmas\//);
  assert.match(timetable, /return \(\) => ctrl.abort\(\)/);
  assert.match(direct, /<ProfessorTurmaHorario/);
});

test("dashboard operational drawers reuse authorized workspaces and guard mutations", () => {
  const dashboard = read("app/professor/page.tsx");
  const navigator = read("components/portal/ui/PortalDrawerNavigator.tsx");
  const attendance = read("components/professor/ProfessorFrequenciasWorkspace.tsx");
  const plans = read("components/professor/ProfessorPlanosWorkspace.tsx");
  const materials = read("components/professor/ProfessorMateriaisWorkspace.tsx");
  const student = read("components/aluno/dashboard/DashboardLoader.tsx");
  for (const operation of ["attendance", "plans", "materials"]) {
    assert.ok(dashboard.includes('openOperation("' + operation + '")'));
    assert.ok(dashboard.includes('operationFrame("' + operation + '", selectedTurma.id)'));
  }
  assert.match(navigator, /registerGuard/);
  assert.match(navigator, /canLeave\(activeIds\)/);
  assert.match(navigator, /canLeave\(\[last.frame.id\]\)/);
  assert.match(navigator, /busy=\{busy\}/);
  assert.match(attendance, /usePortalDrawerGuard\(attendanceDirty, saving\)/);
  assert.match(attendance, /mobile && !embedded/);
  assert.match(plans, /usePortalDrawerGuard\(dirty, saving\)/);
  assert.match(materials, /usePortalDrawerGuard\(dirty, saving \|\| updatingId !== null\)/);
  assert.match(student, /kind: "notice", noticeId: a.id/);
  assert.match(read("app/professor/frequencias/page.tsx"), /<ProfessorFrequenciasWorkspace/);
  assert.match(read("app/professor/planos-aula/page.tsx"), /<ProfessorPlanosWorkspace/);
  assert.match(read("app/professor/materiais/page.tsx"), /<ProfessorMateriaisWorkspace/);
});

test("student dashboard reuses guarded academic and financial workspaces", () => {
  const dashboard = read("components/aluno/dashboard/DashboardLoader.tsx");
  const workspace = read("components/aluno/dashboard/StudentDrawerWorkspace.tsx");
  const academic = read("components/aluno/academico/AcademicoWorkspace.tsx");
  const navigator = read("components/portal/ui/PortalDrawerNavigator.tsx");
  const sheet = read("components/portal/ui/PortalSheet.tsx");
  const finance = read("components/aluno/tabs/TabFinanceiro.tsx");
  const notes = read("components/aluno/tabs/TabNotas.tsx");
  const absences = read("components/aluno/tabs/TabFaltas.tsx");
  const documents = read("components/aluno/tabs/TabDocumentos.tsx");
  const consolidated = read("components/aluno/financeiro-portal/PaymentDrawer.tsx");
  const service = read("components/aluno/layout/ServicePaymentDrawer.tsx");
  assert.match(dashboard, /openDrawer\("academic"\)/);
  assert.match(dashboard, /openDrawer\("finance"\)/);
  assert.match(dashboard, /onChanged=\{refresh\}/);
  assert.match(workspace, /<Academic embedded/);
  assert.match(workspace, /<Finance onOpenDocuments=/);
  assert.match(workspace, /<Documents embedded/);
  assert.match(academic, /if \(embedded\) return;\s*const url = new URL/);
  assert.match(academic, /if \(guarded\) return/);
  assert.match(navigator, /register\(id, sourceId, \{ dirty, busy \}\)/);
  assert.match(navigator, /notifyChanged/);
  assert.match(sheet, /props.inline \? <InlinePortalPanel/);
  assert.match(finance, /inert=\{Boolean\(navigation && paymentOpen\)\}/);
  assert.match(notes, /<AcademicRequestPanel inline=\{Boolean\(navigation\)\}/);
  assert.match(absences, /usePortalDrawerGuard\(detailOpen && Boolean\(reason.trim\(\)\), sending\)/);
  assert.match(documents, /if \(onOpenNotices\) \{ onOpenNotices\(\); return; \}/);
  for (const payment of [consolidated, service]) {
    assert.match(payment, /inline=\{Boolean\(navigation\)\}/);
    assert.match(payment, /usePortalDrawerGuard\(open && Boolean\(selectedFile \|\| mensagem.trim\(\)\), open && sending\)/);
  }
});
