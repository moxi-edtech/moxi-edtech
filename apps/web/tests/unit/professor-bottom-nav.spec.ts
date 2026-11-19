import assert from "node:assert/strict";
import test from "node:test";
import { getActiveProfessorNavHref, professorNavItems } from "../../src/lib/professorNav";

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
