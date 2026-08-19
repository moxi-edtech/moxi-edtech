import assert from "node:assert/strict"
import test from "node:test"
import { resolveRaaDecretoEligibility, type RaaDecretoDisciplina } from "../../src/lib/academico/raa-decreto-eligibility"

const d = (id: string, notaFinal: number, extra: Partial<RaaDecretoDisciplina> = {}): RaaDecretoDisciplina => ({ id, nome: id, notaFinal, ...extra })

test("7.ª transita condicionalmente com duas notas 7-9, sem LP+Matemática", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_7", disciplinas: [d("lp", 8, { linguaPortuguesa: true }), d("hist", 7)] })
  assert.equal(result.decision, "inscricao_condicional")
  assert.equal(result.exameExtraordinario, true)
  assert.match(result.baseLegal, /23.º/)
})

test("7.ª reprova com LP e Matemática negativas", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_7", disciplinas: [d("lp", 8, { linguaPortuguesa: true }), d("mat", 7, { matematica: true })] })
  assert.equal(result.decision, "reprovado")
  assert.equal(result.motivo, "combinacao_proibida")
})

test("8.ª condicional fica bloqueada para efetivação na 9.ª", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_8", disciplinas: [d("hist", 7)] })
  assert.equal(result.decision, "inscricao_condicional")
  assert.equal(result.efetivacaoMatriculaBloqueada, true)
})

test("10.ª admite até três notas 7-9 quando não há LP e duas específicas", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_10", disciplinas: [d("hist", 7), d("fis", 8, { especifica: true }), d("qui", 9, { especifica: true })] })
  assert.equal(result.decision, "inscricao_condicional")
})

test("10.ª bloqueia LP com duas específicas", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_10", disciplinas: [d("lp", 8, { linguaPortuguesa: true }), d("fis", 8, { especifica: true }), d("qui", 9, { especifica: true })] })
  assert.equal(result.decision, "reprovado")
  assert.equal(result.motivo, "combinacao_proibida")
})

test("6.ª habilita recurso somente com duas notas 3-4", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_6", disciplinas: [d("hist", 3), d("geo", 4)] })
  assert.equal(result.decision, "recurso")
  assert.equal(result.elegivelRecurso, true)
})

test("6.ª não habilita recurso para nota abaixo de 3", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_6", disciplinas: [d("hist", 2), d("geo", 4)] })
  assert.equal(result.decision, "reprovado")
})

test("9.ª habilita recurso com até três notas 6-9 sem LP+Matemática", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_9", disciplinas: [d("hist", 6), d("geo", 7), d("fis", 9)] })
  assert.equal(result.decision, "recurso")
})

test("12.ª bloqueia LP+Matemática+específica", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_12", disciplinas: [d("lp", 8, { linguaPortuguesa: true }), d("mat", 7, { matematica: true }), d("fis", 9, { especifica: true })] })
  assert.equal(result.decision, "reprovado")
  assert.match(result.baseLegal, /33.º\/8/)
})

test("12.ª aceita recurso com três negativas sem combinação proibida", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_12", disciplinas: [d("hist", 6), d("geo", 7), d("fis", 9, { especifica: true })] })
  assert.equal(result.decision, "recurso")
})

test("faltas legais por carga semanal prevalecem sobre notas", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_7", disciplinas: [d("hist", 10, { temposSemanais: 1, faltasInjustificadasPorTrimestre: [3] })] })
  assert.equal(result.decision, "reprovado_por_faltas")
})

test("EJA Primário reprova abaixo de 2/3 de frequência", () => {
  const result = resolveRaaDecretoEligibility({ regime: "eja_modulo_1", disciplinas: [{ id: "area", nome: "Área", suficiente: true }], frequenciaAnual: { aulasFrequentadas: 60, aulasPrevistas: 100 } })
  assert.equal(result.decision, "reprovado_por_faltas")
  assert.equal(result.motivo, "frequencia_eja")
})

test("EJA Primário transita somente com todas as áreas Suficiente", () => {
  const result = resolveRaaDecretoEligibility({ regime: "eja_modulo_2", disciplinas: [{ id: "area1", nome: "Área 1", suficiente: true }, { id: "area2", nome: "Área 2", suficiente: true }], frequenciaAnual: { aulasFrequentadas: 70, aulasPrevistas: 100 } })
  assert.equal(result.decision, "transitou")
})

test("EJA 1.º ano segue a regra de duas notas 7-9 e condicionalidade", () => {
  const result = resolveRaaDecretoEligibility({ regime: "eja_ano_1", disciplinas: [d("hist", 7)] })
  assert.equal(result.decision, "inscricao_condicional")
  assert.equal(result.exameExtraordinario, true)
})

test("EJA Módulo 3 numérico usa recurso de uma negativa 3-4", () => {
  const result = resolveRaaDecretoEligibility({
    regime: "eja_modulo_3",
    disciplinas: [
      { id: "historia", nome: "História", notaFinal: 4 },
      { id: "portugues", nome: "Língua Portuguesa", notaFinal: 10 },
    ],
  })

  assert.equal(result.decision, "recurso")
  assert.equal(result.elegivelRecurso, true)
  assert.match(result.baseLegal, /33.º/)
})

test("dados incompletos nunca aprovam", () => {
  const result = resolveRaaDecretoEligibility({ regime: "classe_12", disciplinas: [{ id: "lp", nome: "LP", notaFinal: null }] })
  assert.equal(result.decision, "pendente_dados")
  assert.equal(result.efetivacaoMatriculaBloqueada, true)
})
