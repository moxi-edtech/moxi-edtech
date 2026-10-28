import test from "node:test";
import assert from "node:assert/strict";

import { resolveClasseNumero } from "../../src/lib/rematricula/classe-numero";

test("resolves grades from the name when legacy numero is null", () => {
  assert.equal(resolveClasseNumero({ numero: null, nome: "8ª Classe" }), 8);
  assert.equal(resolveClasseNumero({ numero: null, nome: "9ª Classe" }), 9);
  assert.equal(resolveClasseNumero({ numero: null, nome: "10ª Classe" }), 10);
  assert.equal(resolveClasseNumero({ numero: "", nome: "11ª Classe" }), 11);
});

test("recognizes preschool without confusing null with zero", () => {
  assert.equal(resolveClasseNumero({ numero: 0, nome: "Pré-Escolar" }), 0);
  assert.equal(resolveClasseNumero({ numero: null, nome: "Pré-Escolar" }), 0);
  assert.equal(resolveClasseNumero({ numero: null, nome: "" }), null);
  assert.equal(resolveClasseNumero(null), null);
});

test("prefers explicit valid numbers and rejects unrecognized grades", () => {
  assert.equal(resolveClasseNumero({ numero: 8, nome: "8ª Classe" }), 8);
  assert.equal(resolveClasseNumero({ numero: "10", nome: "10ª Classe" }), 10);
  assert.equal(resolveClasseNumero({ numero: "invalid", nome: "12ª Classe" }), 12);
  assert.equal(resolveClasseNumero({ numero: null, nome: "Turma X" }), null);
  assert.equal(resolveClasseNumero({ numero: null, nome: "18ª Classe" }), null);
});
