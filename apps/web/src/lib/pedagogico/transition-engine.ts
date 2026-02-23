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
