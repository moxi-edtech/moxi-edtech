import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateMac,
  calculateMfc,
  calculateMfdExame,
  calculateMfdTransicao,
  calculateMt,
  resolveRaaResultColor,
  roundRaa,
} from "../../src/lib/academico/raa-formulas"

test("RAA arredonda uma única vez no ponto de saída", () => {
  assert.equal(roundRaa(7.26), 7.3)
  assert.equal(roundRaa(7.245, 2), 7.25)
})

test("MAC calcula a média dos instrumentos válidos", () => {
  assert.equal(calculateMac([10, 8, null, 9]), 9)
  assert.equal(calculateMac([]), null)
})

test("MT usa pesos recebidos do modelo e exige MAC e NPT", () => {
  assert.equal(calculateMt(8, 10, { peso_mac: 0.4, peso_npt: 0.6 }), 9.2)
  assert.equal(calculateMt(8, null), null)
})

test("MFD de transição é a média dos três momentos", () => {
  assert.equal(calculateMfdTransicao(8, 9, 10), 9)
  assert.equal(calculateMfdTransicao(8, 9, null), null)
})

test("MFD de exame usa os pesos do regime, sem hardcode da classe", () => {
  assert.equal(calculateMfdExame(12, 16, { peso_percurso: 0.6, peso_exame: 0.4 }), 13.6)
  assert.equal(calculateMfdExame(12, null, { peso_percurso: 0.6, peso_exame: 0.4 }), null)
})

test("MFC e cor são derivadas apenas dos valores finais", () => {
  assert.equal(calculateMfc([10, 12, null]), 11)
  assert.equal(resolveRaaResultColor(10, 10), "blue")
  assert.equal(resolveRaaResultColor(9.9, 10), "red")
  assert.equal(resolveRaaResultColor(null, 10), null)
})
