/**
 * Motor jurídico do RAA (Decreto Executivo 04/2026).
 *
 * Este módulo não lê configuração da escola e não calcula médias. Recebe as
 * médias finais já resolvidas pelo SSOT e aplica apenas as condições legais.
 */

export type RaaDecretoRegime =
  | "classe_6"
  | "classe_7"
  | "classe_8"
  | "classe_9"
  | "classe_10"
  | "classe_11"
  | "classe_12"
  | "eja_modulo_1"
  | "eja_modulo_2"
  | "eja_modulo_3"
  | "eja_ano_1"
  | "eja_ano_2"

export type RaaDecretoDisciplina = {
  id: string
  nome: string
  notaFinal?: number | null
  suficiente?: boolean | null
  areaConhecimento?: boolean
  especifica?: boolean
  linguaPortuguesa?: boolean
  matematica?: boolean
  faltasInjustificadasPorTrimestre?: number[] | null
  temposSemanais?: number | null
}

export type RaaDecretoInput = {
  regime: RaaDecretoRegime
  disciplinas: RaaDecretoDisciplina[]
  dadosCompletos?: boolean
  indisciplinaGrave?: boolean
  frequenciaAnual?: { aulasFrequentadas: number; aulasPrevistas: number } | null
}

export type RaaDecretoDecision =
  | "aprovado"
  | "transitou"
  | "inscricao_condicional"
  | "recurso"
  | "reprovado"
  | "reprovado_por_faltas"
  | "reprovado_por_indisciplina"
  | "pendente_dados"
  | "concluiu"

export type RaaDecretoResult = {
  decision: RaaDecretoDecision
  elegivelRecurso: boolean
  exameExtraordinario: boolean
  efetivacaoMatriculaBloqueada: boolean
  disciplinasNegativas: string[]
  disciplinasPendentes: string[]
  motivo: "sem_pendencias" | "negativas_faixa_legal" | "combinacao_proibida" | "faltas" | "indisciplina_grave" | "dados_pendentes" | "frequencia_eja"
  baseLegal: string
}

function pending(input: RaaDecretoInput, baseLegal: string): RaaDecretoResult {
  return {
    decision: "pendente_dados",
    elegivelRecurso: false,
    exameExtraordinario: false,
    efetivacaoMatriculaBloqueada: true,
    disciplinasNegativas: [],
    disciplinasPendentes: input.disciplinas.filter((d) => d.notaFinal == null && d.suficiente == null).map((d) => d.id),
    motivo: "dados_pendentes",
    baseLegal,
  }
}

function hasBadAttendance(discipline: RaaDecretoDisciplina): boolean {
  const threshold = (discipline.temposSemanais ?? 0) <= 1 ? 3 : (discipline.temposSemanais ?? 0) === 2 ? 4 : 5
  return (discipline.faltasInjustificadasPorTrimestre ?? []).some((faltas) => faltas >= threshold)
}

function isNegative(discipline: RaaDecretoDisciplina, ejaPrimary: boolean): boolean {
  if (ejaPrimary) return discipline.suficiente === false
  return discipline.notaFinal != null && discipline.notaFinal < 10
}

function legalNotes(negatives: RaaDecretoDisciplina[], min: number, max: number): boolean {
  return negatives.every((d) => (d.notaFinal ?? 0) >= min && (d.notaFinal ?? 0) <= max)
}

function hasLpMath(negatives: RaaDecretoDisciplina[]): boolean {
  return negatives.some((d) => d.linguaPortuguesa) && negatives.some((d) => d.matematica)
}

function result(input: RaaDecretoInput, values: Partial<RaaDecretoResult> & Pick<RaaDecretoResult, "decision" | "motivo" | "baseLegal">): RaaDecretoResult {
  return {
    decision: values.decision,
    motivo: values.motivo,
    baseLegal: values.baseLegal,
    elegivelRecurso: values.elegivelRecurso ?? false,
    exameExtraordinario: values.exameExtraordinario ?? false,
    efetivacaoMatriculaBloqueada: values.efetivacaoMatriculaBloqueada ?? false,
    disciplinasNegativas: values.disciplinasNegativas ?? input.disciplinas.filter((d) => isNegative(d, input.regime.startsWith("eja_modulo"))).map((d) => d.id),
    disciplinasPendentes: values.disciplinasPendentes ?? [],
  }
}

export function resolveRaaDecretoEligibility(input: RaaDecretoInput): RaaDecretoResult {
  if (input.dadosCompletos === false || input.disciplinas.length === 0 || input.disciplinas.some((d) => d.notaFinal == null && d.suficiente == null)) {
    return pending(input, "Arts. 23.º/1, 26.º/1 e 38.º: resultado incompleto não produz aprovação automática.")
  }

  if (input.indisciplinaGrave) {
    return result(input, { decision: "reprovado_por_indisciplina", motivo: "indisciplina_grave", baseLegal: "Arts. 23.º/7/d-8, 24.º/15/d-16 e 26.º/2/c-3.", efetivacaoMatriculaBloqueada: true })
  }

  // O Módulo 3 tem dois enquadramentos no Decreto: conclusão do módulo
  // qualitativo (art. 26.º) e recurso numérico (art. 33.º/6). Quando a
  // pauta já traz notas finais, o segundo enquadramento prevalece.
  const ejaModulo3Numerico = input.regime === "eja_modulo_3" && input.disciplinas.some((d) => d.notaFinal != null)
  const ejaPrimary = (input.regime === "eja_modulo_1" || input.regime === "eja_modulo_2" || input.regime === "eja_modulo_3") && !ejaModulo3Numerico
  if (ejaPrimary) {
    const frequency = input.frequenciaAnual
    if (!frequency || frequency.aulasPrevistas <= 0 || frequency.aulasFrequentadas / frequency.aulasPrevistas < 2 / 3) {
      return result(input, { decision: "reprovado_por_faltas", motivo: "frequencia_eja", baseLegal: "Art. 26.º/2/b.", efetivacaoMatriculaBloqueada: true })
    }
    const negatives = input.disciplinas.filter((d) => isNegative(d, true))
    if (negatives.length > 0) return result(input, { decision: "reprovado", motivo: "negativas_faixa_legal", baseLegal: "Art. 26.º/1-2.", efetivacaoMatriculaBloqueada: true })
    return result(input, { decision: input.regime === "eja_modulo_3" ? "concluiu" : "transitou", motivo: "sem_pendencias", baseLegal: "Art. 26.º/1.", efetivacaoMatriculaBloqueada: false })
  }

  if (input.disciplinas.some(hasBadAttendance)) {
    return result(input, { decision: "reprovado_por_faltas", motivo: "faltas", baseLegal: "Arts. 23.º/7/a-c e 24.º/15/a-c.", efetivacaoMatriculaBloqueada: true })
  }

  const negatives = input.disciplinas.filter((d) => isNegative(d, false))
  const regime = input.regime
  const transition = regime === "classe_7" || regime === "classe_8" || regime === "classe_10" || regime === "classe_11" || regime === "eja_ano_1"
  const terminal = regime === "classe_6" || regime === "classe_9" || regime === "classe_12" || regime === "eja_ano_2"

  if (negatives.length === 0) {
    return result(input, { decision: terminal ? "concluiu" : "transitou", motivo: "sem_pendencias", baseLegal: "Arts. 23.º/1/6/9/14 e 26.º/4/8.", efetivacaoMatriculaBloqueada: false })
  }

  if (regime === "classe_7" || regime === "classe_8" || regime === "eja_ano_1") {
    const allowed = legalNotes(negatives, 7, 9) && negatives.length <= 2 && !hasLpMath(negatives)
    if (allowed) return result(input, { decision: "inscricao_condicional", motivo: "negativas_faixa_legal", exameExtraordinario: true, efetivacaoMatriculaBloqueada: regime === "classe_8" || regime === "eja_ano_1", baseLegal: "Arts. 23.º/2-5 e 26.º/5-7." })
    return result(input, { decision: "reprovado", motivo: "combinacao_proibida", baseLegal: "Arts. 23.º/2 e 26.º/5.", efetivacaoMatriculaBloqueada: true })
  }

  if (regime === "classe_10" || regime === "classe_11") {
    const specific = negatives.filter((d) => d.especifica).length
    const prohibited = negatives.some((d) => d.linguaPortuguesa) && specific >= 2
    const allowed = legalNotes(negatives, 7, 9) && negatives.length <= 3 && !prohibited
    if (allowed) return result(input, { decision: "inscricao_condicional", motivo: "negativas_faixa_legal", exameExtraordinario: true, efetivacaoMatriculaBloqueada: regime === "classe_11", baseLegal: "Art. 23.º/9-13." })
    return result(input, { decision: "reprovado", motivo: "combinacao_proibida", baseLegal: "Art. 23.º/10.", efetivacaoMatriculaBloqueada: true })
  }

  if (regime === "classe_6") {
    const allowed = legalNotes(negatives, 3, 4) && negatives.length === 2 && !hasLpMath(negatives)
    return allowed
      ? result(input, { decision: "recurso", motivo: "negativas_faixa_legal", elegivelRecurso: true, baseLegal: "Art. 33.º/1-5.", efetivacaoMatriculaBloqueada: true })
      : result(input, { decision: "reprovado", motivo: "combinacao_proibida", baseLegal: "Art. 33.º/5.", efetivacaoMatriculaBloqueada: true })
  }

  if (regime === "eja_modulo_3") {
    const allowed = legalNotes(negatives, 3, 4) && negatives.length === 1
    return allowed
      ? result(input, { decision: "recurso", motivo: "negativas_faixa_legal", elegivelRecurso: true, baseLegal: "Art. 33.º/1-2/6.", efetivacaoMatriculaBloqueada: true })
      : result(input, { decision: "reprovado", motivo: "negativas_faixa_legal", baseLegal: "Art. 33.º/6.", efetivacaoMatriculaBloqueada: true })
  }

  if (regime === "classe_9" || regime === "eja_ano_2") {
    const allowed = legalNotes(negatives, 6, 9) && negatives.length <= 3 && !hasLpMath(negatives)
    return allowed
      ? result(input, { decision: "recurso", motivo: "negativas_faixa_legal", elegivelRecurso: true, baseLegal: "Art. 33.º/1-2/7.", efetivacaoMatriculaBloqueada: true })
      : result(input, { decision: "reprovado", motivo: "combinacao_proibida", baseLegal: "Art. 33.º/7.", efetivacaoMatriculaBloqueada: true })
  }

  if (regime === "classe_12") {
    const specific = negatives.filter((d) => d.especifica).length
    const lp = negatives.some((d) => d.linguaPortuguesa)
    const math = negatives.some((d) => d.matematica)
    const prohibited = (lp && math && specific >= 1) || (lp && specific >= 2) || (math && specific >= 2)
    const allowed = legalNotes(negatives, 6, 9) && negatives.length <= 3 && !prohibited
    return allowed
      ? result(input, { decision: "recurso", motivo: "negativas_faixa_legal", elegivelRecurso: true, baseLegal: "Art. 33.º/1-2/8.", efetivacaoMatriculaBloqueada: true })
      : result(input, { decision: "reprovado", motivo: "combinacao_proibida", baseLegal: "Art. 33.º/8/a-c.", efetivacaoMatriculaBloqueada: true })
  }

  return result(input, { decision: "reprovado", motivo: "negativas_faixa_legal", baseLegal: "Decreto Executivo 04/2026: regime não resolvido.", efetivacaoMatriculaBloqueada: true })
}
