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
  const [academic, tabs, alunoNav, profNav, sharedNav] = await Promise.all([
    read("components/aluno/academico/AcademicoWorkspace.tsx"),
    read("components/portal/ui/PortalTabs.tsx"),
    read("components/aluno/layout/AlunoBottomNav.tsx"),
    read("components/professor/layout/ProfessorBottomNav.tsx"),
    read("components/layout/klasse/PortalBottomNav.tsx"),
  ]);
  assert.doesNotMatch(academic, /descriptions\[activeTab\]/);
  assert.match(academic, /layout="compact"/);
  assert.match(tabs, /grid grid-cols-4/);
  assert.match(academic, /<PortalTabs items=\{sections\}/);
  assert.match(tabs, /border-klasse-gold/);
  for (const wrapper of [alunoNav, profNav]) {
    assert.match(wrapper, /import \{ PortalBottomNav, type PortalBottomNavItem \} from "@\/components\/layout\/klasse\/PortalBottomNav"/);
    assert.match(wrapper, /<PortalBottomNav\b/);
    assert.match(wrapper, /mainItems=\{mainItems\.map\(toLink\)\}/);
    assert.match(wrapper, /drawerItems=\{drawerItems\.map\(toLink\)\}/);
  }
  assert.match(alunoNav, /activeHref=\{active \? withAlunoParam\(active\.href\) : null\}/);
  assert.match(profNav, /activeHref=\{activeHref\}/);
  assert.match(sharedNav, /active \? "bg-klasse-gold-50 text-klasse-gold-700 ring-1 ring-klasse-gold\/30"/);
  assert.match(sharedNav, /active \? "border-klasse-gold\/40 bg-klasse-gold-50 text-klasse-gold-700"/);
  assert.match(sharedNav, /isDrawerActive \|\| isMoreOpen \? "bg-klasse-gold-50 text-klasse-gold-700/);
  assert.match(sharedNav, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(sharedNav, /min-h-12/);
  assert.match(sharedNav, /focus-visible:ring-4 focus-visible:ring-klasse-gold\/20/);
  assert.match(sharedNav, /aria-expanded=\{isMoreOpen\}/);
  assert.match(sharedNav, /aria-modal="true"/);
  assert.match(sharedNav, /event\.key === "Escape"/);
  assert.match(sharedNav, /safe-area-inset-bottom/);
  assert.match(sharedNav, /bg-destructive[^"]*text-background/);
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
  assert.match(principal, /<PortalWelcomeCard role="aluno"/);
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
  assert.match(dashboard, /grid-cols-2 gap-2 min-\[380px\]:grid-cols-3/);
  assert.match(card, /mobileCompact = false/);
  assert.match(card, /unavailable: disabled \|\| unavailable/);
  assert.match(card, /min-h-16[^"]*bg-card p-3/);
  assert.match(card, /min-h-\[88px\][^"]*bg-card p-4/);
  assert.match(card, /if \(href\) return <Link href=\{href\}/);
  assert.match(dashboard, /href=\{go\("\/aluno\/horario"\)\}/);
  assert.match(dashboard, /href=\{go\(item.href\)\}/);
  assert.doesNotMatch(dashboard, /<PortalStatCard/);
});

test("restante portal do aluno usa cards compartilhados sem alterar operações", async () => {
  const [finance, schedule, attendance, subjects, docs, profile, identity, card, notices, activity, runner] = await Promise.all([
    read("components/aluno/tabs/TabFinanceiro.tsx"),
    read("components/aluno/tabs/TabHorario.tsx"),
    read("components/aluno/tabs/TabFaltas.tsx"),
    read("components/aluno/disciplinas/DisciplinasList.tsx"),
    read("components/aluno/tabs/TabDocumentos.tsx"),
    read("components/aluno/tabs/TabPerfil.tsx"),
    read("components/aluno/tabs/CartaoEstudante.tsx"),
    read("components/shared/AcaoRapidaCard.tsx"),
    read("components/aluno/tabs/TabNotificacoes.tsx"),
    read("app/(portal-aluno)/aluno/atividades/page.tsx"),
    read("app/(portal-aluno)/aluno/atividades/[id]/page.tsx"),
  ]);
  for (const page of [finance, schedule, attendance, subjects]) assert.match(page, /dashboardCompact mobileCompact/);
  assert.match(card, /emphasizeSublabel = false/);
  assert.match(finance, /label="Por pagar"[\s\S]*?resumo\.total_pendente/);
  assert.match(finance, /<PaymentDrawer/);
  assert.match(finance, /<StudentAppyPayButton/);
  assert.doesNotMatch(finance, /Timeline SSOT|Livro Razão/);
  assert.match(schedule, /aria-pressed=\{activeDay === dia.id\}/);
  assert.match(schedule, /grid grid-cols-5/);
  assert.match(schedule, /min-h-11 min-w-0/);
  assert.match(attendance, /safeData\.can_submit/);
  assert.match(attendance, /frequencia_id: item.id/);
  assert.match(docs, /<ServicePaymentDrawer/);
  assert.match(docs, /doc\.reject_reason/);
  for (const id of ["nome", "login", "email", "telefone", "morada", "senha-atual", "senha", "confirmacao"]) {
    assert.ok(profile.includes('htmlFor="aluno-perfil-' + id + '"'));
    assert.ok(profile.includes('id="aluno-perfil-' + id + '"'));
  }
  assert.match(profile, /onSubmit=\{handleSalvarDados\}/);
  assert.match(profile, /onSubmit=\{handleSalvarSenha\}/);
  assert.match(identity, /bgColor="#ffffff"/);
  assert.match(identity, /value=\{data.verification_url\}/);
  assert.match(notices, /role="alert"/);
  assert.match(activity, /Retomar Rascunho/);
  assert.match(runner, /handleSaveSubmission\(true\)/);
});

test("QR de identidade mantém zona de silêncio e contraste próprios sem superfície fixa no tema", async () => {
  const identity = await read("components/aluno/tabs/CartaoEstudante.tsx");
  assert.match(identity, /<svg viewBox="0 0 252 252" width=\{252\} height=\{252\}/);
  assert.match(identity, /<rect width=\{252\} height=\{252\} rx=\{8\} fill="#ffffff"/);
  assert.match(identity, /<QRCode\s+x=\{36\}\s+y=\{36\}\s+value=\{data.verification_url\}\s+size=\{180\}\s+bgColor="#ffffff"\s+fgColor="#0f172a"/);
  assert.doesNotMatch(identity, /\bbg-white\b/);
  assert.doesNotMatch(identity, /viewBox=\{`0 0 256 256`\}/);
});

test("cartão digital usa superfícies e texto semânticos no modo claro e escuro", async () => {
  const identity = await read("components/aluno/tabs/CartaoEstudante.tsx");
  assert.match(identity, /min-h-\[215px\][^"]*border-border bg-card[^"]*text-foreground/);
  assert.match(identity, /rounded-xl border border-border bg-muted/);
  assert.doesNotMatch(identity, /\b(?:bg-white|(?:bg|text|border|ring)-(?:slate|gray|zinc)-\d+|(?:border|ring)-white)\b/);
  assert.match(identity, /data\.verification_url/);
});
