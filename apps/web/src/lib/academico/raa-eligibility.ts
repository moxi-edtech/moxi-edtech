export type RaaAcademicStatus = "aprovado" | "recurso" | "reprovado" | "reprovado_por_faltas" | "reprovado_por_indisciplina" | "pendente_dados" | "pendente_formula"

export type RaaEligibilityPolicy = {
  negativasParaReprovar: number
  permitirRecurso: boolean
  permitirInscricaoCondicional: boolean
  frequenciaMinimaPercentual?: number | null
}

export type RaaEligibilityFacts = {
  quantidadeNegativas: number
  percentualPresenca?: number | null
  dadosCompletos?: boolean
}

export type RaaEligibilityResult = {
  status: RaaAcademicStatus
  elegivelRecurso: boolean
  elegivelInscricaoCondicional: boolean
  motivo: "faltas" | "indisciplina_grave" | "negativas_limite" | "negativa_recurso" | "sem_pendencias" | "dados_pendentes" | "formula_pendente"
}

export function resolveRaaEligibilityFromCanonicalStatus(
  canonicalStatus: string,
  options: { dadosCompletos: boolean; retidoPorFaltas: boolean; permitirInscricaoCondicional: boolean },
): RaaEligibilityResult {
  if (!options.dadosCompletos) return { status: "pendente_dados", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "dados_pendentes" }
  if (/pendente_formula/i.test(canonicalStatus)) return { status: "pendente_formula", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "formula_pendente" }
  if (options.retidoPorFaltas || /faltas/i.test(canonicalStatus)) return { status: "reprovado_por_faltas", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "faltas" }
  if (/indisciplina/i.test(canonicalStatus)) return { status: "reprovado_por_indisciplina", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "indisciplina_grave" }
  if (/recurso/i.test(canonicalStatus)) return { status: "recurso", elegivelRecurso: true, elegivelInscricaoCondicional: options.permitirInscricaoCondicional, motivo: "negativa_recurso" }
  if (/reprov/i.test(canonicalStatus)) return { status: "reprovado", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "negativas_limite" }
  return { status: "aprovado", elegivelRecurso: false, elegivelInscricaoCondicional: false, motivo: "sem_pendencias" }
}

export function resolveRaaEligibility(
  facts: RaaEligibilityFacts,
  policy: RaaEligibilityPolicy,
): RaaEligibilityResult {
  if (facts.dadosCompletos === false) {
    return {
      status: "pendente_dados",
      elegivelRecurso: false,
      elegivelInscricaoCondicional: false,
      motivo: "dados_pendentes",
    }
  }

  const attendanceThreshold = policy.frequenciaMinimaPercentual
  if (
    attendanceThreshold != null &&
    facts.percentualPresenca != null &&
    facts.percentualPresenca < attendanceThreshold
  ) {
    return {
      status: "reprovado_por_faltas",
      elegivelRecurso: false,
      elegivelInscricaoCondicional: false,
      motivo: "faltas",
    }
  }

  if (facts.quantidadeNegativas >= policy.negativasParaReprovar) {
    return {
      status: "reprovado",
      elegivelRecurso: false,
      elegivelInscricaoCondicional: false,
      motivo: "negativas_limite",
    }
  }

  if (facts.quantidadeNegativas > 0) {
    const elegivelRecurso = policy.permitirRecurso
    return {
      status: elegivelRecurso ? "recurso" : "reprovado",
      elegivelRecurso,
      elegivelInscricaoCondicional: elegivelRecurso && policy.permitirInscricaoCondicional,
      motivo: "negativa_recurso",
    }
  }

  return {
    status: "aprovado",
    elegivelRecurso: false,
    elegivelInscricaoCondicional: false,
    motivo: "sem_pendencias",
  }
}

export function calculateReapreciacaoDeadline(submittedAt: Date | string, hours = 48): Date {
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("O prazo deve ser maior que zero.")
  const base = submittedAt instanceof Date ? submittedAt : new Date(submittedAt)
  if (Number.isNaN(base.getTime())) throw new Error("Data de submissão inválida.")
  return new Date(base.getTime() + hours * 60 * 60 * 1000)
}
