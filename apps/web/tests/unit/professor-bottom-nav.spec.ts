import assert from "node:assert/strict";
import test from "node:test";
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
