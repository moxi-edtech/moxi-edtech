/**
 * Cross-course exception for a mistaken CURRENT-YEAR enrollment.
 *
 * This only controls which options the UI presents. The RPC remains the
 * authority for tenant, permissions, session, vacancies and academic evidence.
 * Academic progression between years must use the RAA flow instead.
 */
export type ClassCorrectionTurma = {
  id: string;
  classe_id?: string | null;
  classe_num?: number | null;
  curso_id?: string | null;
  nivel_ensino?: string | null;
};

export function isPrimaryToFirstCycleCorrection(
  source: ClassCorrectionTurma,
  destination: ClassCorrectionTurma,
): boolean {
  return Boolean(
    source.curso_id && destination.curso_id &&
    source.curso_id !== destination.curso_id &&
    source.classe_num === 6 && destination.classe_num === 7 &&
    source.nivel_ensino === "primario" &&
    destination.nivel_ensino === "secundario",
  );
}

export function isAllowedClassCorrectionTarget(
  source: ClassCorrectionTurma | null | undefined,
  destination: ClassCorrectionTurma,
): boolean {
  if (!source || !source.classe_id || !source.curso_id ||
      !destination.classe_id || !destination.curso_id) return false;
  if (source.id === destination.id || source.classe_id === destination.classe_id) return false;
  return source.curso_id === destination.curso_id ||
    isPrimaryToFirstCycleCorrection(source, destination);
}
