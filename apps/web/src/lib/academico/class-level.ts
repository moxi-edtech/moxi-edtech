/**
 * Canonical Angola academic class labels. This is the *grade level*, not
 * a menu position, course version or number of classes in a school.
 *
 * Unknown/custom names remain unclassified and must be configured explicitly.
 * Database stores Pré-Escolar as numero=NULL and ordem=0.
 */
export function parseAcademicClassNumber(name: string | null | undefined): number | null {
  const label = String(name ?? "").trim();
  const match = label.match(/^([1-9]|1[0-3])[ªº]?\s*(?:classe|ano)$/i);
  return match ? Number(match[1]) : null;
}

export function isPreschoolAcademicClass(name: string | null | undefined): boolean {
  return /^pré[\s-]*escolar$/i.test(String(name ?? "").trim());
}

export function classIdentityFromName(name: string | null | undefined): {
  numero: number | null;
  ordem: number | null;
} {
  const number = parseAcademicClassNumber(name);
  if (number !== null) return { numero: number, ordem: number };
  if (isPreschoolAcademicClass(name)) return { numero: null, ordem: 0 };
  return { numero: null, ordem: null };
}
