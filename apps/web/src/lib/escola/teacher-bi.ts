/** Missing BI is represented by null; never invent a document number. */
export function normalizeTeacherBi(value: string | null | undefined): string | null {
  return value?.trim().toUpperCase() || null
}

export function isTeacherBiValid(value: string | null | undefined): boolean {
  const bi = normalizeTeacherBi(value)
  return bi === null || (/^[A-Z0-9]{14}$/.test(bi) && !/^0+$/.test(bi))
}
