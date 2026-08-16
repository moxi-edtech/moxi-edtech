/**
 * Funções matemáticas puras do RAA.
 *
 * O regime, a escala e os pesos vêm do resolvedor académico. Este módulo
 * apenas executa a fórmula recebida; não decide se uma turma é de exame.
 */

export type RaaFormulaWeights = {
  peso_mac?: number | null
  peso_npt?: number | null
  peso_percurso?: number | null
  peso_exame?: number | null
}

export type RaaResultColor = "blue" | "red" | null

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value)

export function roundRaa(value: number, decimals = 1): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function averageRaa(values: Array<number | null | undefined>, decimals = 1): number | null {
  const valid = values.filter(finite)
  if (!valid.length) return null
  return roundRaa(valid.reduce((sum, value) => sum + value, 0) / valid.length, decimals)
}

export function calculateMac(
  assessmentValues: Array<number | null | undefined>,
  decimals = 1
): number | null {
  return averageRaa(assessmentValues, decimals)
}

export function calculateMt(
  mac: number | null | undefined,
  npt: number | null | undefined,
  weights: RaaFormulaWeights = {},
  decimals = 1
): number | null {
  if (!finite(mac) || !finite(npt)) return null

  const pesoMac = weights.peso_mac ?? 0.4
  const pesoNpt = weights.peso_npt ?? 0.6
  const total = pesoMac + pesoNpt
  if (total <= 0) return null

  return roundRaa((mac * pesoMac + npt * pesoNpt) / total, decimals)
}

export function calculateMfdTransicao(
  mt1: number | null | undefined,
  mt2: number | null | undefined,
  mt3: number | null | undefined,
  decimals = 1
): number | null {
  if (!finite(mt1) || !finite(mt2) || !finite(mt3)) return null
  return averageRaa([mt1, mt2, mt3], decimals)
}

export function calculateMfdExame(
  percurso: number | null | undefined,
  exame: number | null | undefined,
  weights: RaaFormulaWeights,
  decimals = 1
): number | null {
  if (!finite(percurso) || !finite(exame)) return null
  const pesoPercurso = weights.peso_percurso ?? 0
  const pesoExame = weights.peso_exame ?? 0
  const total = pesoPercurso + pesoExame
  if (total <= 0) return null
  return roundRaa((percurso * pesoPercurso + exame * pesoExame) / total, decimals)
}

export function calculateMfc(
  finalDisciplineValues: Array<number | null | undefined>,
  decimals = 1
): number | null {
  return averageRaa(finalDisciplineValues, decimals)
}

export function resolveRaaResultColor(
  value: number | null | undefined,
  cut: number | null | undefined
): RaaResultColor {
  if (!finite(value) || !finite(cut)) return null
  return value >= cut ? "blue" : "red"
}
