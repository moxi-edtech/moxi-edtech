import assert from "node:assert/strict"
import test from "node:test"
import { calculateReapreciacaoDeadline, resolveRaaEligibility } from "../../src/lib/academico/raa-eligibility"

const policy = {
  negativasParaReprovar: 3,
  permitirRecurso: true,
  permitirInscricaoCondicional: true,
  frequenciaMinimaPercentual: 75,
}

test("aluno sem negativas fica aprovado", () => {
  assert.deepEqual(resolveRaaEligibility({ quantidadeNegativas: 0, percentualPresenca: 96 }, policy), {
    status: "aprovado",
    elegivelRecurso: false,
    elegivelInscricaoCondicional: false,
    motivo: "sem_pendencias",
  })
})

test("uma ou duas negativas habilitam recurso e inscrição condicional quando a política permite", () => {
  const result = resolveRaaEligibility({ quantidadeNegativas: 1, percentualPresenca: 90 }, policy)
  assert.equal(result.status, "recurso")
  assert.equal(result.elegivelRecurso, true)
  assert.equal(result.elegivelInscricaoCondicional, true)
})

test("atingir o limite de negativas reprova sem recurso", () => {
  const result = resolveRaaEligibility({ quantidadeNegativas: 3, percentualPresenca: 90 }, policy)
  assert.equal(result.status, "reprovado")
  assert.equal(result.elegivelRecurso, false)
})

test("frequência abaixo do limite prevalece como reprovação por faltas", () => {
  const result = resolveRaaEligibility({ quantidadeNegativas: 1, percentualPresenca: 74.99 }, policy)
  assert.equal(result.status, "reprovado_por_faltas")
  assert.equal(result.motivo, "faltas")
})

test("dados incompletos não são apresentados como aprovação", () => {
  const result = resolveRaaEligibility({ quantidadeNegativas: 0, dadosCompletos: false }, policy)
  assert.equal(result.status, "pendente_dados")
  assert.equal(result.motivo, "dados_pendentes")
})

test("prazo de reapreciação é calculado em 48 horas", () => {
  const deadline = calculateReapreciacaoDeadline("2026-08-15T10:00:00.000Z")
  assert.equal(deadline.toISOString(), "2026-08-17T10:00:00.000Z")
})
