import type { StudentPautaRow } from "@/lib/pedagogico/grade-engine"

export type FinalStatus = "APROVADO" | "REPROVADO" | "RECURSO" | "PENDENTE"

export type TransitionRules = {
  notaMinimaAprovacao: number
  maxNegativasParaRecurso: number
}

const DEFAULT_MED_RULES: TransitionRules = {
  notaMinimaAprovacao: 10,
  maxNegativasParaRecurso: 2,
}

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const pickNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in source) {
      const parsed = toNumber(source[key])
      if (parsed !== null) return parsed
    }
  }
  return null
}

export const resolveTransitionRules = (
  regras?: Record<string, unknown> | null,
  overrides?: Partial<TransitionRules>
): TransitionRules => {
  const base = (regras && typeof regras === "object" ? regras : {}) as Record<string, unknown>
  const scoped =
    (base.transicao as Record<string, unknown> | undefined) ??
    (base.aprovacao as Record<string, unknown> | undefined) ??
    base

  const min = pickNumber(scoped, [
    "notaMinimaAprovacao",
    "nota_minima_aprovacao",
    "minimo_aprovacao",
    "nota_minima",
  ])
  const max = pickNumber(scoped, [
    "maxNegativasParaRecurso",
    "max_negativas_recurso",
    "max_negativas",
  ])

  return {
    notaMinimaAprovacao:
      overrides?.notaMinimaAprovacao ?? min ?? DEFAULT_MED_RULES.notaMinimaAprovacao,
    maxNegativasParaRecurso:
      overrides?.maxNegativasParaRecurso ?? max ?? DEFAULT_MED_RULES.maxNegativasParaRecurso,
  }
}

export class TransitionEngine {
  public static evaluateStudent(
    student: StudentPautaRow,
    rules: TransitionRules = DEFAULT_MED_RULES
  ): FinalStatus {
    let negativasCount = 0
    let isPendente = false

    const disciplinas = Object.values(student.disciplinas)
    if (disciplinas.length === 0) return "PENDENTE"

    for (const subject of disciplinas) {
      if (subject.mfd === "-") {
        isPendente = true
        break
      }

      if (subject.mfd < rules.notaMinimaAprovacao) {
        negativasCount += 1
      }
    }

    if (isPendente) return "PENDENTE"
    if (negativasCount === 0) return "APROVADO"
    if (negativasCount <= rules.maxNegativasParaRecurso) return "RECURSO"
    return "REPROVADO"
  }

  public static processTurma(
    pautaTurma: StudentPautaRow[],
    rules: TransitionRules = DEFAULT_MED_RULES
  ) {
    return pautaTurma.map((student) => {
      const disciplinas = Object.values(student.disciplinas)
      const totalNegativas = disciplinas.filter(
        (d) => d.mfd !== "-" && d.mfd < rules.notaMinimaAprovacao
      ).length

      return {
        ...student,
        resultado_final: this.evaluateStudent(student, rules),
        total_negativas: totalNegativas,
      }
    })
  }
}
