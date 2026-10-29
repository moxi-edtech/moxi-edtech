import test from "node:test";
import assert from "node:assert/strict";

import { canSelectRematriculaDestination } from "../../src/lib/rematricula/balcao-destino";

const turma = "00000000-0000-0000-0000-000000000001";

test("Balcão permite promoção e repetição autorizada pelo RAA", () => {
  assert.equal(canSelectRematriculaDestination({ estado: "aprovado", modo: "promocao" }, turma), true);
  assert.equal(canSelectRematriculaDestination({ estado: "condicional", modo: "promocao" }, turma), true);
  assert.equal(canSelectRematriculaDestination({ estado: "reprovado", modo: "retencao" }, turma), true);
});

test("Balcão não permite escolher turma com bloqueio académico ou sem destino", () => {
  for (const estado of ["notas_pendentes", "recurso", "retencao_faltas", "retencao_indisciplina", "concluido", "classe_nao_identificada"] as const) {
    assert.equal(canSelectRematriculaDestination({ estado, modo: "indefinida" }, turma), false, estado);
  }
  assert.equal(canSelectRematriculaDestination({ estado: "reprovado", modo: "promocao" }, turma), false);
  assert.equal(canSelectRematriculaDestination({ estado: "aprovado", modo: "promocao" }, null), false);
  assert.equal(canSelectRematriculaDestination(null, turma), false);
});
