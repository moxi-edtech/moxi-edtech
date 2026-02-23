export type RawGradeRow = {
  aluno_id: string
  aluno_nome: string
  numero_turma: number
  disciplina_id: string
  disciplina_nome: string
  trimestre: 1 | 2 | 3
  mac: number | null
  npp: number | null
  pt: number | null
}

export type CalculatedTerm = {
  mac: number | "-"
  npp: number | "-"
  pt: number | "-"
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
  npp?: number
  pt?: number
}

const EMPTY_TERM: CalculatedTerm = {
  mac: "-",
  npp: "-",
  pt: "-",
  mt: "-",
}

export class GradeEngine {
  private static round1Decimal(value: number): number {
    return Number(Math.round(Number(`${value}e1`)) + "e-1")
  }

  private static normalizeWeights(weights?: GradeWeights) {
    const mac = weights?.mac ?? 1
    const npp = weights?.npp ?? 1
    const pt = weights?.pt ?? 1
    const total = mac + npp + pt
    return { mac, npp, pt, total: total > 0 ? total : 3 }
  }

  private static calculateMT(
    mac: number | null,
    npp: number | null,
    pt: number | null,
    weights?: GradeWeights
  ): number | "-" {
    if (mac === null || npp === null || pt === null) return "-"

    const { mac: wMac, npp: wNpp, pt: wPt, total } = this.normalizeWeights(weights)
    const media = (mac * wMac + npp * wNpp + pt * wPt) / total
    return this.round1Decimal(media)
  }

  private static calculateMFD(mt1: number | "-", mt2: number | "-", mt3: number | "-") {
    if (mt1 === "-" || mt2 === "-" || mt3 === "-") return "-"
    const mediaFinal = (mt1 + mt2 + mt3) / 3
    return Math.round(mediaFinal)
  }

  public static generatePautaMatrix(rawGrades: RawGradeRow[], weights?: GradeWeights) {
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

      subject[termKey] = {
        mac: row.mac ?? "-",
        npp: row.npp ?? "-",
        pt: row.pt ?? "-",
        mt: this.calculateMT(row.mac, row.npp, row.pt, weights),
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
