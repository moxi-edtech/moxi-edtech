import type { RaaAcademicStatus } from "@/lib/academico/raa-eligibility"
import type { RaaDecretoDecision } from "@/lib/academico/raa-decreto-eligibility"

export type RaaProgressionStage = {
  nivelEnsino: "primario" | "secundario" | "eja" | string
  classeNum?: number | null
  anoNumero?: number | null
  moduloNumero?: number | null
  ehClasseExame?: boolean
}

export type RaaProgressionDecision =
  | "transitou"
  | "inscricao_condicional"
  | "recurso"
  | "retido"
  | "retido_por_faltas"
  | "retido_por_indisciplina"
  | "pendente"
  | "concluiu"

export type RaaProgressionInput = {
  disciplinas: Array<{
    disciplinaId?: string | null
    status: RaaAcademicStatus
  }>
  etapaAtual: RaaProgressionStage
  dadosCompletos?: boolean
  permitirInscricaoCondicional?: boolean
  permitirProgressaoComRecurso?: boolean
  retidoPorFaltas?: boolean
  retidoPorIndisciplina?: boolean
  /** Resultado jurídico já resolvido pelo Decreto Executivo 04/2026. */
  decretoDecision?: RaaDecretoDecision | null
  decretoMatriculaBloqueada?: boolean
}

export type RaaProgressionResult = {
  decision: RaaProgressionDecision
  destino: "proxima_etapa" | "mesma_etapa" | "conclusao" | "aguardar_dados"
  disciplinaIdsPendentes: string[]
  motivo:
    | "dados_pendentes"
    | "faltas"
    | "indisciplina_grave"
    | "aproveitamento"
    | "recurso"
    | "sem_pendencias"
  etapaDestino: RaaProgressionStage | null
}

function isTerminalStage(stage: RaaProgressionStage): boolean {
  if (stage.ehClasseExame) return true
  if (stage.nivelEnsino === "primario") return stage.classeNum === 6
  if (stage.nivelEnsino === "secundario") return stage.classeNum === 12
  if (stage.nivelEnsino === "eja") return stage.moduloNumero === 3 || stage.anoNumero === 2
  return false
}

function nextStage(stage: RaaProgressionStage): RaaProgressionStage | null {
  if (isTerminalStage(stage)) return null

  if (stage.nivelEnsino === "eja") {
    if (stage.moduloNumero != null) return { ...stage, moduloNumero: stage.moduloNumero + 1 }
    if (stage.anoNumero != null) return { ...stage, anoNumero: stage.anoNumero + 1 }
    return null
  }

  if (stage.classeNum == null) return null
  return { ...stage, classeNum: stage.classeNum + 1 }
}

function pendingDisciplineIds(disciplinas: RaaProgressionInput["disciplinas"]): string[] {
  return disciplinas
    .filter(({ status }) => status !== "aprovado")
    .map(({ disciplinaId }) => disciplinaId)
    .filter((id): id is string => Boolean(id))
}

/**
 * Resolve o movimento global do aluno a partir dos estados disciplinares
 * calculados pelo SSOT. Esta função não recalcula notas, frequência ou regime.
 */
export function resolveRaaProgression(input: RaaProgressionInput): RaaProgressionResult {
  const pendingIds = pendingDisciplineIds(input.disciplinas)
  const destination = nextStage(input.etapaAtual)

  if (input.decretoDecision) {
    const legal = input.decretoDecision
    if (legal === "pendente_dados") {
      return { decision: "pendente", destino: "aguardar_dados", disciplinaIdsPendentes: pendingIds, motivo: "dados_pendentes", etapaDestino: null }
    }
    if (legal === "reprovado_por_indisciplina") {
      return { decision: "retido_por_indisciplina", destino: "mesma_etapa", disciplinaIdsPendentes: pendingIds, motivo: "indisciplina_grave", etapaDestino: input.etapaAtual }
    }
    if (legal === "reprovado_por_faltas") {
      return { decision: "retido_por_faltas", destino: "mesma_etapa", disciplinaIdsPendentes: pendingIds, motivo: "faltas", etapaDestino: input.etapaAtual }
    }
    if (legal === "reprovado") {
      return { decision: "retido", destino: "mesma_etapa", disciplinaIdsPendentes: pendingIds, motivo: "aproveitamento", etapaDestino: input.etapaAtual }
    }
    if (legal === "recurso") {
      return { decision: "recurso", destino: "mesma_etapa", disciplinaIdsPendentes: pendingIds, motivo: "recurso", etapaDestino: input.etapaAtual }
    }
    if (legal === "inscricao_condicional") {
      return {
        decision: "inscricao_condicional",
        destino: input.decretoMatriculaBloqueada ? "mesma_etapa" : "proxima_etapa",
        disciplinaIdsPendentes: pendingIds,
        motivo: "recurso",
        etapaDestino: input.decretoMatriculaBloqueada ? input.etapaAtual : destination,
      }
    }
    if (legal === "concluiu") {
      return { decision: "concluiu", destino: "conclusao", disciplinaIdsPendentes: [], motivo: "sem_pendencias", etapaDestino: null }
    }
    if (legal === "transitou" || legal === "aprovado") {
      return { decision: "transitou", destino: destination ? "proxima_etapa" : "conclusao", disciplinaIdsPendentes: [], motivo: "sem_pendencias", etapaDestino: destination }
    }
  }

  if (input.disciplinas.length === 0 || input.dadosCompletos === false || input.disciplinas.some(({ status }) => status === "pendente_dados" || status === "pendente_formula")) {
    return {
      decision: "pendente",
      destino: "aguardar_dados",
      disciplinaIdsPendentes: pendingIds,
      motivo: "dados_pendentes",
      etapaDestino: null,
    }
  }

  if (input.retidoPorIndisciplina || input.disciplinas.some(({ status }) => status === "reprovado_por_indisciplina")) {
    return {
      decision: "retido_por_indisciplina",
      destino: "mesma_etapa",
      disciplinaIdsPendentes: pendingIds,
      motivo: "indisciplina_grave",
      etapaDestino: input.etapaAtual,
    }
  }

  if (input.retidoPorFaltas || input.disciplinas.some(({ status }) => status === "reprovado_por_faltas")) {
    return {
      decision: "retido_por_faltas",
      destino: "mesma_etapa",
      disciplinaIdsPendentes: pendingIds,
      motivo: "faltas",
      etapaDestino: input.etapaAtual,
    }
  }

  if (input.disciplinas.some(({ status }) => status === "reprovado")) {
    return {
      decision: "retido",
      destino: "mesma_etapa",
      disciplinaIdsPendentes: pendingIds,
      motivo: "aproveitamento",
      etapaDestino: input.etapaAtual,
    }
  }

  const hasRecurso = input.disciplinas.some(({ status }) => status === "recurso")
  if (hasRecurso) {
    const canProgress = input.permitirProgressaoComRecurso !== false
    const canConditional = input.permitirInscricaoCondicional === true && canProgress
    return {
      decision: canConditional ? "inscricao_condicional" : "recurso",
      destino: canConditional && destination ? "proxima_etapa" : "mesma_etapa",
      disciplinaIdsPendentes: pendingIds,
      motivo: canConditional ? "recurso" : "recurso",
      etapaDestino: canConditional ? destination : input.etapaAtual,
    }
  }

  if (destination) {
    return {
      decision: "transitou",
      destino: "proxima_etapa",
      disciplinaIdsPendentes: [],
      motivo: "sem_pendencias",
      etapaDestino: destination,
    }
  }

  return {
    decision: "concluiu",
    destino: "conclusao",
    disciplinaIdsPendentes: [],
    motivo: "sem_pendencias",
    etapaDestino: null,
  }
}
