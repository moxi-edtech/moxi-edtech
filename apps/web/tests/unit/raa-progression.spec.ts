import assert from "node:assert/strict"
import test from "node:test"
import { resolveRaaProgression } from "../../src/lib/academico/raa-progression"

const etapa8 = {
  nivelEnsino: "secundario" as const,
  classeNum: 8,
  ehClasseExame: false,
}

test("aluno aprovado transita para a etapa sequencial", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "aprovado" }],
    etapaAtual: etapa8,
  })

  assert.equal(result.decision, "transitou")
  assert.deepEqual(result.etapaDestino, { ...etapa8, classeNum: 9 })
})

test("recurso vira inscrição condicional apenas quando a política permite", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "fis", status: "recurso" }],
    etapaAtual: etapa8,
    permitirInscricaoCondicional: true,
  })

  assert.equal(result.decision, "inscricao_condicional")
  assert.equal(result.destino, "proxima_etapa")
  assert.deepEqual(result.disciplinaIdsPendentes, ["fis"])
})

test("recurso sem política condicional mantém o aluno na etapa atual", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "fis", status: "recurso" }],
    etapaAtual: etapa8,
    permitirInscricaoCondicional: false,
  })

  assert.equal(result.decision, "recurso")
  assert.equal(result.destino, "mesma_etapa")
  assert.deepEqual(result.etapaDestino, etapa8)
})

test("reprovação por aproveitamento retém na mesma etapa", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "reprovado" }],
    etapaAtual: etapa8,
    permitirInscricaoCondicional: true,
  })

  assert.equal(result.decision, "retido")
  assert.equal(result.motivo, "aproveitamento")
  assert.equal(result.destino, "mesma_etapa")
})

test("faltas e indisciplina conservam motivos próprios e prevalecem sobre aproveitamento", () => {
  const faltas = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "reprovado_por_faltas" }],
    etapaAtual: etapa8,
  })
  const indisciplina = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "reprovado_por_indisciplina" }],
    etapaAtual: etapa8,
  })

  assert.equal(faltas.decision, "retido_por_faltas")
  assert.equal(indisciplina.decision, "retido_por_indisciplina")
})

test("classe terminal aprovada conclui em vez de inventar uma próxima classe", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "aprovado" }],
    etapaAtual: { nivelEnsino: "secundario", classeNum: 12, ehClasseExame: true },
  })

  assert.equal(result.decision, "concluiu")
  assert.equal(result.destino, "conclusao")
  assert.equal(result.etapaDestino, null)
})

test("dados incompletos nunca são apresentados como transição", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "mat", status: "pendente_formula" }],
    etapaAtual: etapa8,
  })

  assert.equal(result.decision, "pendente")
  assert.equal(result.destino, "aguardar_dados")
})

test("turma sem disciplinas fica pendente e não libera a transição", () => {
  const result = resolveRaaProgression({ disciplinas: [], etapaAtual: etapa8 })

  assert.equal(result.decision, "pendente")
  assert.equal(result.destino, "aguardar_dados")
})

test("decisão jurídica de recurso não pode ser convertida por flag de escola", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "lp", status: "recurso" }],
    etapaAtual: etapa8,
    permitirInscricaoCondicional: true,
    decretoDecision: "recurso",
  })

  assert.equal(result.decision, "recurso")
  assert.equal(result.destino, "mesma_etapa")
})

test("inscrição condicional jurídica respeita o bloqueio de efetivação", () => {
  const result = resolveRaaProgression({
    disciplinas: [{ disciplinaId: "hist", status: "recurso" }],
    etapaAtual: etapa8,
    permitirInscricaoCondicional: false,
    decretoDecision: "inscricao_condicional",
    decretoMatriculaBloqueada: true,
  })

  assert.equal(result.decision, "inscricao_condicional")
  assert.equal(result.destino, "mesma_etapa")
  assert.deepEqual(result.etapaDestino, etapa8)
})
