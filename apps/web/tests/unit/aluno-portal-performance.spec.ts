import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (path: string) => readFile(new URL(`../../src/${path}`, import.meta.url), "utf8");

test("dashboard mostra o resumo antes de esperar pelas quatro APIs facultativas", async () => {
  const ui = await source("components/aluno/dashboard/DashboardLoader.tsx");
  const primary = ui.indexOf("setScreen({ dashboard: dash");
  const optional = ui.indexOf("void Promise.allSettled([");
  assert.ok(primary >= 0 && optional > primary, "a resposta principal deve ser publicada primeiro");
  assert.match(ui, /fetchJson<BoletimData>\("\/api\/aluno\/boletim"/);
  assert.match(ui, /fetchJson<CatalogoData>\("\/api\/aluno\/documentos\/catalogo"/);
  assert.match(ui, /fetchJson<RaaData>\("\/api\/aluno\/home\/raa-status"/);
  assert.match(ui, /controller\.signal\.aborted/);
  assert.doesNotMatch(ui, /const boletim = await fetchJson/);
});

test("layout não bloqueia cada clique com consulta de sessão do browser", async () => {
  const server = await source("app/(portal-aluno)/aluno/layout.tsx");
  const client = await source("app/(portal-aluno)/aluno/AlunoLayoutClient.tsx");
  assert.match(server, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(server, /supabase\.auth\.getSession\(\)/);
  assert.match(server, /\.from\("escola_users"\)/);
  assert.match(server, /portalEnabled=\{Boolean\(escolaInfo\.aluno_portal_enabled\)\}/);
  assert.doesNotMatch(client, /\.auth\.getUser\(\)/);
  assert.doesNotMatch(client, /\.from\("escola_users"\)/);
  assert.doesNotMatch(client, /router\.prefetch\(/);
  assert.match(client, /onAuthStateChange/);
  assert.match(client, /if \(redirectTarget\) return null/);
});

test("a API mantém autorização do boletim, isolamento por escola e consultas paralelas", async () => {
  const route = await source("app/api/aluno/dashboard/route.ts");
  assert.match(route, /getAlunoContext\(\)/);
  assert.match(route, /checkBoletimAccess\(/);
  assert.match(route, /\.eq\('escola_id', escolaId\)/);
  assert.match(route, /\.eq\('matricula_id', matriculaId\)/);
  assert.match(route, /await Promise\.all\(\[/);
  assert.match(route, /dadosPagamentoPromise/);
  assert.doesNotMatch(route, /searchParams\.get\(['"]studentId['"]\)/);
});

test("resolução de contexto sobrepõe vínculos e ano letivo sem cache de permissão entre pedidos", async () => {
  const context = await source("lib/alunoContext.ts");
  const studentAuth = await source("lib/portalAlunoAuth.ts");
  assert.match(context, /supabase\.auth\.getUser\(\)/);
  assert.match(context, /Promise\.all\(\[/);
  assert.match(context, /resolveAuthorizedStudentIds\(\{/);
  assert.match(context, /resolveAnoLetivoScope\(supabase, escolaId\)/);
  assert.match(context, /\.eq\('aluno_id', alunoId\)/);
  assert.match(context, /ACTIVE_MATRICULA_STATUSES/);
  assert.doesNotMatch(context, /unstable_cache|localStorage|sessionStorage/);
  assert.match(studentAuth, /Promise\.all\(\[\s*directRowsPromise,\s*encarregadoPromise/);
  assert.match(studentAuth, /\.eq\("escola_id", escolaId\)/);
  assert.match(studentAuth, /\.eq\("encarregado_id", encarregadoId\)/);
});

test("layout valida acesso e consulta escola e política financeira em paralelo", async () => {
  const layout = await source("app/(portal-aluno)/aluno/layout.tsx");
  assert.match(layout, /supabase\.auth\.getUser\(\)/);
  assert.match(layout, /const vincPortal =/);
  assert.match(layout, /Promise\.all\(\[directPromise, guardianPromise\]\)/);
  assert.match(layout, /const \[escolaResult, configuracoesResult\] = await Promise\.all\(\[/);
  assert.match(layout, /if \(escolaInfo\.status === "suspensa"\)/);
  assert.match(layout, /if \(configuracoes\?\.bloquear_inadimplentes\)/);
  assert.match(layout, /if \(bloqueado\)/);
  assert.match(layout, /key=\{\x60\$\{escolaId\}:\$\{user\.id\}\x60\}/);
});

test("endpoints usam IDs autorizados do contexto corrente, sem duplicar getUser e consultas a vínculos", async () => {
  const paths = [
    "boletim/route.ts",
    "boletim/pdf/route.ts",
    "horario/route.ts",
    "home/status/route.ts",
    "home/finance-alert/route.ts",
    "home/recent-grades/route.ts",
    "raa/dependencias/route.ts",
    "financeiro/route.ts",
    "financeiro/comprovativo/route.ts",
    "perfil/identidade/route.ts",
    "documentos/catalogo/route.ts",
    "documentos/solicitar/route.ts",
    "documentos/emitir/route.ts",
    "documentos/comprovativo/route.ts",
  ];
  await Promise.all(paths.map(async (path) => {
    const route = await source(`app/api/aluno/${path}`);
    assert.match(route, /getAlunoContext\(\)/, path);
    assert.match(route, /const authorizedIds = ctx\.alunoIds;/, path);
    assert.match(route, /resolveSelectedStudentId\(/, path);
    assert.doesNotMatch(route, /resolveAuthorizedStudentIds\(/, path);
    assert.doesNotMatch(route, /supabase\.auth\.getUser\(\)/, path);
  }));
});
