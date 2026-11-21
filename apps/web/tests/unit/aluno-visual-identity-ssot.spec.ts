import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildStudentPortalHref } from "../../src/lib/navigation";

const source = (path: string) =>
  readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");

test("rota escola/aluno usa o shell canónico, sem criar contexto visual paralelo", () => {
  const route = source("app/escola/[id]/aluno/layout.tsx");
  const layout = source("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  assert.match(route, /portal-aluno\)\/aluno\/layout/);
  assert.match(layout, /klasse-portal-theme/);
  assert.match(layout, /<main id="conteudo-aluno"/);
  assert.match(layout, /max-w-\[1200px\]/);
  assert.doesNotMatch(layout, /rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6/);
  assert.match(layout, /<NetworkStatus \/>/);
  assert.match(layout, /<PWAInstallPrompt \/>/);
  assert.match(layout, /<AlunoBottomNav items=\{navItems\}/);
  assert.match(layout, /params\.set\("aluno", alunoSelecionado\)/);
  assert.match(layout, /router\.replace\(/);
});

test("header mantém escola, logo, troca de educando, saída e foco acessível", () => {
  const header = source("components/aluno/layout/AlunoHeader.tsx");
  assert.match(header, /logo-klasse-ui\.png/);
  assert.match(header, /const schoolLabel = escolaNome\?\.trim\(\) \|\| "KLASSE"/);
  assert.match(header, /title=\{schoolLabel\}/);
  assert.match(header, /escolaNome,\s*alunoSelecionadoNome,/);
  assert.match(header, /onChange=\{\(event\) => onSelectAluno\(event\.target\.value\)\}/);
  assert.match(header, /<SignOutButton/);
  assert.match(header, /focus-visible:ring-4/);
  assert.doesNotMatch(header, /parts\.slice\(0, 2\)/);
});

test("navegação mobile mantém as nove rotas, contexto, preloading e teclado", () => {
  const nav = source("components/aluno/layout/AlunoBottomNav.tsx");
  const layout = source("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  assert.match(nav, /const mainItems = items\.slice\(0, 4\)/);
  assert.match(nav, /const drawerItems = items\.slice\(4\)/);
  assert.match(nav, /withAlunoParam\(href\)/);
  assert.match(nav, /preloadPortalData/);
  assert.match(nav, /aria-modal="true"/);
  assert.match(nav, /event\.key === "Escape"/);
  assert.match(nav, /min-h-12/);
  assert.match(nav, /klasse-gold/);
  for (const route of [
    "/aluno/dashboard", "/aluno/horario", "/aluno/academico", "/aluno/financeiro",
    "/aluno/atividades", "/aluno/identidade", "/aluno/documentos", "/aluno/avisos", "/aluno/perfil",
  ]) {
    assert.ok(layout.includes(route), "Rota preservada: " + route);
  }
});

test("dashboard mostra dados reais e superfícies compactas, sem homepage promocional", () => {
  const page = source("components/aluno/dashboard/DashboardLoader.tsx");
  assert.match(page, /data-testid="aluno-dashboard-editorial"/);
  assert.match(page, /<PortalStatCard label="Avisos"/);
  assert.match(page, /<PortalStatCard label="Notas"/);
  assert.match(page, /<PortalStatCard label="Vencidas"/);
  assert.match(page, /typeof screen\.boletim\?\.is_liberado === "boolean"/);
  assert.match(page, /screen\.dashboard\.status_financeiro && !screen\.dashboard\.status_financeiro\.error/);
  assert.match(page, /bg-klasse-green/);
  assert.match(page, /rounded-xl border border-border bg-card/);
  assert.doesNotMatch(page, /-right-12 -top-20 h-64 w-64/);
});

test("páginas ativas não criam fundos distintos dentro do shell", () => {
  for (const route of ["horario", "financeiro", "documentos", "perfil", "identidade"]) {
    const page = source("app/(portal-aluno)/aluno/" + route + "/page.tsx");
    assert.doesNotMatch(page, /bg-slate-50/);
  }
  const action = source("components/portal/ui/PortalAction.tsx");
  assert.match(action, /rounded-xl/);
  assert.match(action, /min-h-11/);
});

test("pagamentos, notas e documentos mantêm operações e estados autorizados", () => {
  const financeiro = source("components/aluno/tabs/TabFinanceiro.tsx");
  const notas = source("components/aluno/tabs/TabNotas.tsx");
  const documentos = source("components/aluno/tabs/TabDocumentos.tsx");
  assert.match(financeiro, /<StudentAppyPayButton/);
  assert.match(financeiro, /<PaymentDrawer/);
  assert.match(financeiro, /handleReprintRecibo/);
  assert.match(financeiro, /serviceStatusClass/);
  assert.match(notas, /safeIsLiberado/);
  assert.match(documentos, /<ServicePaymentDrawer/);
  assert.match(documentos, /nav\.set\("ano_letivo_id", academicYearId\)/);
});

test("identidade preserva QR e offline; actividades mantêm acesso ao rascunho", () => {
  const digital = source("components/aluno/tabs/CartaoEstudante.tsx");
  const activities = source("app/(portal-aluno)/aluno/atividades/page.tsx");
  const home = source("components/aluno/tabs/TabHome.tsx");
  assert.match(digital, /<QRCode/);
  assert.match(digital, /data\.verification_url/);
  assert.match(digital, /readIdentityCardCache\(localStorage, cacheKey\)/);
  assert.match(digital, /aria-pressed=\{activeTab === "card"\}/);
  assert.match(activities, /Retomar Rascunho/);
  assert.match(activities, /Iniciar Actividade/);
  assert.match(home, /<CircularProgressbar/);
  assert.match(home, /mediaNotas === null/);
});


test("links do aluno preservam tenant, educando e ano, sem transportar query operacional", () => {
  assert.equal(
    buildStudentPortalHref(
      "/escola/curtume/aluno/atividades",
      "?aluno=aluno-42&ano_letivo_id=ano-2026&token=privado",
      "/aluno/atividades/atividade-7",
    ),
    "/escola/curtume/aluno/atividades/atividade-7?aluno=aluno-42&ano_letivo_id=ano-2026",
  );
  assert.equal(
    buildStudentPortalHref(
      "/escola/curtume/aluno/academico",
      "aluno=antigo&ano_letivo_id=ano-2026",
      "/aluno/academico?aba=disciplinas&aluno=especifico",
    ),
    "/escola/curtume/aluno/academico?aba=disciplinas&aluno=especifico&ano_letivo_id=ano-2026",
  );
  assert.equal(
    buildStudentPortalHref("/aluno/atividades", "", "/aluno/documentos"),
    "/aluno/documentos",
  );
  assert.equal(
    buildStudentPortalHref("/escola/escola-2/aluno", "aluno=A%26B", "/aluno/perfil"),
    "/escola/escola-2/aluno/perfil?aluno=A%26B",
  );
});

test("rotas de actividades funcionam em /escola/[id], sem perder o ID da actividade", () => {
  const list = source("app/(portal-aluno)/aluno/atividades/page.tsx");
  const runner = source("app/(portal-aluno)/aluno/atividades/[id]/page.tsx");
  const routed = source("app/escola/[id]/aluno/atividades/[atividadeId]/page.tsx");
  const home = source("components/aluno/tabs/TabHome.tsx");
  assert.match(list, /buildStudentPortalHref\(pathname, searchValue, target\)/);
  assert.match(runner, /buildStudentPortalHref\(pathname, searchValue, target\)/);
  assert.match(home, /buildStudentPortalHref\(pathname, searchValue, target\)/);
  assert.match(routed, /const \{ atividadeId \} = await params/);
  assert.match(routed, /Promise\.resolve\(\{ id: atividadeId \}\)/);
  assert.match(home, /\/api\/aluno\/home\/status\$\{query\}/);
  assert.match(runner, /handleSaveSubmission\(false\)/);
  assert.match(runner, /handleSaveSubmission\(true\)/);
});

test("cartão offline isola contas e escolas e cancela fetch anterior ao trocar de educando", () => {
  const card = source("components/aluno/tabs/CartaoEstudante.tsx");
  const layout = source("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  assert.match(layout, /<AlunoPortalScopeContext\.Provider value=\{portalScope\}>/);
  assert.match(card, /useAlunoPortalScope\(\)/);
  assert.match(card, /scope\?\.userId/);
  assert.match(card, /scope\?\.escolaId/);
  assert.match(card, /identityCardCacheKey\(/);
  assert.doesNotMatch(card, /studentId \?\? "default"/);
  assert.match(card, /pruneIdentityCardCache\(localStorage\)/);
  assert.match(card, /new AbortController\(\)/);
  assert.match(card, /setData\(null\)/);
  assert.match(card, /return \(\) => controller\.abort\(\)/);
  assert.match(card, /saveIdentityCardCache\(localStorage, cacheKey, json\.identidade\)/);
  assert.doesNotMatch(card, /const cacheKey = `\$\{STORAGE_KEY\}\$\{studentId \|\| "default"\}`/);
});
