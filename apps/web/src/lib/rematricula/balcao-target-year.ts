export type BalcaoRematriculaTargetYearInput = {
  sourceAcademicYear: number;
  latestStudentAcademicYear: number;
  openWindowAcademicYear?: number | null;
  hasCurrentAcademicYearOperation: boolean;
};

export function resolveBalcaoRematriculaTargetYear({
  sourceAcademicYear,
  latestStudentAcademicYear,
  openWindowAcademicYear,
  hasCurrentAcademicYearOperation,
}: BalcaoRematriculaTargetYearInput): number {
  if (openWindowAcademicYear != null && Number.isFinite(openWindowAcademicYear)) {
    return Number(openWindowAcademicYear);
  }

  // Uma operação já existente do ano académico seleccionado deve ser resolvida
  // antes de avançar o Balcão para o ano seguinte. Isto evita apresentar
  // 2027/2028 enquanto ainda existe uma rematrícula 2026 paga/pendente.
  if (hasCurrentAcademicYearOperation) {
    return sourceAcademicYear;
  }

  return latestStudentAcademicYear > 0
    ? latestStudentAcademicYear + 1
    : sourceAcademicYear + 1;
}

export function shouldBlockClosedRematriculaWindow(input: {
  windowOpen: boolean;
  hasExistingOperationForTarget: boolean;
}): boolean {
  // A janela fecha a criação de operações novas. Uma operação já existente
  // continua disponível para leitura, retomada, reconciliação ou comprovante.
  return !input.windowOpen && !input.hasExistingOperationForTarget;
}
