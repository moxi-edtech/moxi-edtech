/**
 * Accent-insensitive client-side filtering for teacher resources.
 * Presentation-only: tenant scoping and permissions remain server-enforced.
 */
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-AO");

export function matchesProfessorResourceQuery(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const term = normalize(query.trim());
  if (!term) return true;
  return normalize(fields.filter((part): part is string => typeof part === "string").join(" ")).includes(term);
}
