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
