/** Proposed target-year rule for a rollover from published calendar templates.
 *
 * IMPORTANT: The caller must review whether a template's start/end dates are
 * compatible with the calculated year before enabling this in production.
 */
export function resolveTargetAcademicYear(
  templateBaseYear: number,
  activeAcademicYear: number | null,
): number {
  if (!Number.isInteger(templateBaseYear) || templateBaseYear < 2000 || templateBaseYear > 2100) {
    throw new Error("invalid template base year");
  }
  if (activeAcademicYear === null) return templateBaseYear;
  if (!Number.isInteger(activeAcademicYear) || activeAcademicYear < 2000 || activeAcademicYear > 2100) {
    throw new Error("invalid active academic year");
  }
  return Math.max(templateBaseYear, activeAcademicYear + 1);
}
