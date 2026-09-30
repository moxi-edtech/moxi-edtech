import assert from "node:assert/strict"
import test from "node:test"
import { isRematriculaSourceStatus } from "../../src/lib/alunoRematriculaSource"

test("matrícula histórica concluída ou reprovada pode ser origem", () => {
  assert.equal(isRematriculaSourceStatus("concluido"), true)
  assert.equal(isRematriculaSourceStatus("concluida"), true)
  assert.equal(isRematriculaSourceStatus("reprovado"), true)
  assert.equal(isRematriculaSourceStatus("reprovada"), true)
})

test("pendente não é tratado como resultado académico fechado", () => {
  assert.equal(isRematriculaSourceStatus("pendente"), false)
  assert.equal(isRematriculaSourceStatus(""), false)
  assert.equal(isRematriculaSourceStatus(null), false)
})
