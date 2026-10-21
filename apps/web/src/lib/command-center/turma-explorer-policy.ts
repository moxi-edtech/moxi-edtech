/**
 * Scope must be resolved by the authenticated route before this policy is used.
 * Transferred-out and cancelled students are never part of an enrolment roster.
 */
export function turmaEnrollmentPolicy(historical: boolean) {
  return historical
    ? { statuses: ["ativo", "concluido"] as const, requireActive: false }
    : { statuses: ["ativo"] as const, requireActive: true };
}

/** Server-side pagination avoids the legacy 50-row turma-details truncation. */
export function turmaPageRange(page: number, size = 20) {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100) {
    throw new RangeError("Invalid roster pagination.");
  }
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}
