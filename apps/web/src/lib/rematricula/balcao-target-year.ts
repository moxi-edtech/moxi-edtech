export type BalcaoRematriculaTargetYearInput = {
  /** Ano canónico da sessão seleccionada no Balcão (2026 = 2026/2027). */
  selectedAcademicYear: number;
};

/**
 * A sessão académica seleccionada é o destino do atendimento.
 *
 * Nunca inferir destino com ultimaMatricula.ano_letivo + 1: um aluno já
 * matriculado em 2026/2027 continua a poder consultar/regularizar a sua
 * operação de 2026/2027, sem saltar indevidamente para 2027/2028.
 *
 * Para operar noutro ano, o operador deve escolher explicitamente a respectiva
 * sessão em anos_letivos, cuja configuração segue o calendário oficial MED.
 */
export function resolveBalcaoRematriculaTargetYear({
  selectedAcademicYear,
}: BalcaoRematriculaTargetYearInput): number {
  if (!Number.isInteger(selectedAcademicYear) || selectedAcademicYear < 1900 || selectedAcademicYear > 3000) {
    throw new Error("Ano letivo do contexto académico inválido.");
  }
  return selectedAcademicYear;
}

export function shouldBlockClosedRematriculaWindow(input: {
  windowOpen: boolean;
  hasExistingOperationForTarget: boolean;
}): boolean {
  // A janela fecha a criação de operações novas. Uma operação já existente
  // continua disponível para leitura, retomada, reconciliação ou comprovante.
  return !input.windowOpen && !input.hasExistingOperationForTarget;
}
