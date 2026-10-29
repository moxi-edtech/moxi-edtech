import assert from "node:assert/strict"
import test from "node:test"
import { isRematriculaSourceStatus } from "../../src/lib/alunoRematriculaSource"

test("matrícula de origem usa estados administrativos, não aprovação ou reprovação", () => {
  assert.equal(isRematriculaSourceStatus("concluido"), true)
  assert.equal(isRematriculaSourceStatus("ativo"), true)
  assert.equal(isRematriculaSourceStatus("transferido"), true)
  assert.equal(isRematriculaSourceStatus("concluida"), false)
  assert.equal(isRematriculaSourceStatus("reprovado"), false)
  assert.equal(isRematriculaSourceStatus("reprovada"), false)
  assert.equal(isRematriculaSourceStatus("aprovado"), false)
})

test("pendente não é tratado como resultado académico fechado", () => {
  assert.equal(isRematriculaSourceStatus("pendente"), false)
  assert.equal(isRematriculaSourceStatus(""), false)
  assert.equal(isRematriculaSourceStatus(null), false)
})
