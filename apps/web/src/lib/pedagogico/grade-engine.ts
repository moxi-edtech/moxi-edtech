export type RawGradeRow = {
  aluno_id: string
  aluno_nome: string
  numero_turma: number
  disciplina_id: string
  disciplina_nome: string
  trimestre: 1 | 2 | 3
  mac: number | null
  npt: number | null
}

export type CalculatedTerm = {
  mac: number | "-"
  npt: number | "-"
  mt: number | "-"
}

export type SubjectGrades = {
  disciplina_id: string
  disciplina_nome: string
  t1: CalculatedTerm
  t2: CalculatedTerm
  t3: CalculatedTerm
  mfd: number | "-"
}

export type StudentPautaRow = {
  aluno_id: string
  aluno_nome: string
  numero_turma: number
  disciplinas: Record<string, SubjectGrades>
}

export type GradeWeights = {
  mac?: number
  npt?: number
}

import {
  calculateMfdTransicao,
  roundRaa,
} from "@/lib/academico/raa-formulas"

const EMPTY_TERM: CalculatedTerm = {
  mac: "-",
  npt: "-",
  mt: "-",
}

export class GradeEngine {
  private static normalizeWeights(weights?: GradeWeights) {
    const mac = weights?.mac ?? 1
    const npt = weights?.npt ?? 1
    const total = mac + npt
    return { mac, npt, total: total > 0 ? total : 2 }
  }

  private static calculateMT(
    mac: number | null,
    npt: number | null,
    weights?: GradeWeights
  ): number | "-" {
    if (mac === null || npt === null) return "-"

    const { mac: wMac, npt: wNpt, total } = this.normalizeWeights(weights)
    const media = (mac * wMac + npt * wNpt) / total
    return roundRaa(media)
  }

  private static calculateMFD(mt1: number | "-", mt2: number | "-", mt3: number | "-") {
    if (mt1 === "-" || mt2 === "-" || mt3 === "-") return "-"
    return calculateMfdTransicao(mt1, mt2, mt3) ?? "-"
  }

  public static generatePautaMatrix(
    rawGrades: RawGradeRow[],
    weights?: GradeWeights,
    weightsByDisciplina?: Record<string, GradeWeights>
  ) {
    const pautaMap = new Map<string, StudentPautaRow>()

    rawGrades.forEach((row) => {
      if (!pautaMap.has(row.aluno_id)) {
        pautaMap.set(row.aluno_id, {
          aluno_id: row.aluno_id,
          aluno_nome: row.aluno_nome,
          numero_turma: row.numero_turma,
          disciplinas: {},
        })
      }

      const student = pautaMap.get(row.aluno_id)!

      if (!student.disciplinas[row.disciplina_id]) {
        student.disciplinas[row.disciplina_id] = {
          disciplina_id: row.disciplina_id,
          disciplina_nome: row.disciplina_nome,
          t1: { ...EMPTY_TERM },
          t2: { ...EMPTY_TERM },
          t3: { ...EMPTY_TERM },
          mfd: "-",
        }
      }

      const subject = student.disciplinas[row.disciplina_id]
      const termKey = `t${row.trimestre}` as "t1" | "t2" | "t3"

      const disciplineWeights = weightsByDisciplina?.[row.disciplina_id]
      subject[termKey] = {
        mac: row.mac ?? "-",
        npt: row.npt ?? "-",
        mt: this.calculateMT(
          row.mac,
          row.npt,
          disciplineWeights ?? weights
        ),
      }
    })

    const pautaArray = Array.from(pautaMap.values())
    pautaArray.forEach((student) => {
      Object.values(student.disciplinas).forEach((subject) => {
        subject.mfd = this.calculateMFD(subject.t1.mt, subject.t2.mt, subject.t3.mt)
      })
    })

    return pautaArray.sort((a, b) => a.numero_turma - b.numero_turma)
  }
}
