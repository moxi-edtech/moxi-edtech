/** The recorded frequency remains immutable. Approved petitions supply the
 * legal justification used by RAA, never a synthetic presence or grade. */
export function isUnjustifiedRaaAbsence(
  frequency: { id: string; status: string },
  formallyJustified: ReadonlySet<string>,
): boolean {
  return ["falta", "ausente"].includes(String(frequency.status).toLowerCase()) &&
    !formallyJustified.has(frequency.id);
}
