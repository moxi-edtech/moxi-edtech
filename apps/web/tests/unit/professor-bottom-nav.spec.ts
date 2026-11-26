import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getActiveProfessorNavHref, professorNavItems, splitProfessorMobileNav } from "../../src/lib/professorNav";

const scope = "/escola/curtume";
const items = professorNavItems.map((item) => ({
  ...item,
  href: `${scope}${item.path}`,
}));

test("a rota mais específica activa apenas Calendário, não também Início", () => {
  assert.equal(
    getActiveProfessorNavHref(items, `${scope}/professor/calendario`),
    `${scope}/professor/calendario`,
  );
});

test("o separador mantém-se activo nos percursos aninhados", () => {
  assert.equal(
    getActiveProfessorNavHref(items, `${scope}/professor/notas/alunos`),
    `${scope}/professor/notas`,
  );
});

test("não confunde palavras parecidas com subrotas", () => {
  assert.equal(getActiveProfessorNavHref(items, `${scope}/professor/notas-extra`), `${scope}/professor`);
});

test("a navegação global sem prefixo de escola usa a mesma semântica", () => {
  assert.equal(getActiveProfessorNavHref(items, "/professor/perfil"), `${scope}/professor/perfil`);
  assert.equal(getActiveProfessorNavHref(items, `${scope}/operacoes`), null);
});

test("quatro destinos principais e três secundários, sem perda de rotas ou contexto", () => {
  const {mainItems,drawerItems}=splitProfessorMobileNav([...items].reverse());
  assert.deepEqual(mainItems.map(i=>i.path),["/professor","/professor/frequencias","/professor/notas","/professor/provas"]);
  assert.deepEqual(new Set(drawerItems.map(i=>i.path)),new Set(["/professor/materiais","/professor/calendario","/professor/perfil"]));
  assert.equal(new Set([...mainItems,...drawerItems].map(i=>i.href)).size,items.length);
  for(const item of drawerItems)assert.equal(getActiveProfessorNavHref(items,item.href),item.href);
  assert.ok([...mainItems,...drawerItems].every(item=>item.href.startsWith(scope)));
});

test("professor usa o mesmo drawer do aluno; preserva foco, acessos e prefetch", () => {
  const src = (path: string) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
  const professor = src("components/professor/layout/ProfessorBottomNav.tsx");
  const aluno = src("components/aluno/layout/AlunoBottomNav.tsx");
  const shared = src("components/layout/klasse/PortalBottomNav.tsx");
  assert.match(professor, /<PortalBottomNav/);
  assert.match(aluno, /<PortalBottomNav/);
  assert.match(professor, /moreIcon=\{Plus\}/);
  assert.match(professor, /prefetch: item\.path !== "\/professor\/provas"/);
  assert.match(shared, /grid-cols-5/);
  assert.match(shared, /min-h-12/);
  assert.match(shared, /aria-haspopup="dialog"/);
  assert.match(shared, /aria-modal="true"/);
  assert.match(shared, /event\.key === "Escape"/);
  assert.match(shared, /moreButtonRef\.current\?\.focus\(\)/);
  assert.match(shared, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(shared, /isDrawerActive \|\| isMoreOpen/);
  assert.match(shared, /safe-area-inset-bottom/);
});
test("dashboard do professor usa indicadores estáticos sem remover estados de carregamento", () => {
  const dashboard = readFileSync(new URL("../../src/app/professor/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dashboard, /animate-ping|bg-amber animate-pulse/);
  assert.match(dashboard, /motion-safe:animate-pulse/);
  assert.match(dashboard, /needsAttention=\{!loading && !loadError && avaliacoesPendentes !== null && avaliacoesPendentes > 0\}/);
  assert.match(dashboard, /needsAttention=\{!loading && !loadError && faltasALancar !== null && faltasALancar > 0\}/);
});
