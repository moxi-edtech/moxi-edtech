import assert from "node:assert/strict";
import test from "node:test";
import {
  describeAcademicCarryover,
  type AcademicCarryoverStatus,
} from "../../src/lib/academico/dependencias-transicao";

test("dependência pendente orienta sem prometer resolução", () => {
  const item = describeAcademicCarryover("pendente");
  assert.equal(item.terminal, false);
  assert.equal(item.tone, "amber");
  assert.match(item.nextAction ?? "", /Acompanhar/);
});

test("recurso em andamento é recuperável", () => {
  const item = describeAcademicCarryover("em_recurso", "recurso");
  assert.equal(item.terminal, false);
  assert.match(item.description, /recurso/);
});

test("extraordinário aprovado encerra a dependência", () => {
  const item = describeAcademicCarryover("resolvida_aprovada", "extraordinario");
  assert.equal(item.terminal, true);
  assert.equal(item.tone, "emerald");
  assert.match(item.description, /extraordinário/);
});

test("resultado negativo encerra a avaliação mas mantém decisão académica aberta", () => {
  const item = describeAcademicCarryover("resolvida_reprovada", "recurso");
  assert.equal(item.terminal, false);
  assert.equal(item.tone, "rose");
  assert.match(item.title, /decisão académica necessária/i);
  assert.ok(item.nextAction);
});

test("todos os estados canónicos têm apresentação", () => {
  const states: AcademicCarryoverStatus[] = [
    "pendente",
    "em_recurso",
    "resolvida_aprovada",
    "resolvida_reprovada",
    "cancelada",
  ];
  for (const state of states) {
    assert.ok(describeAcademicCarryover(state).title);
  }
});
