/** Parse user-supplied turma search terms for PostgREST OR filters.
 * Commas, parentheses, wildcard operators and quotes are not permitted in the
 * filter grammar. Never interpolate unvalidated client strings into `.or()`.
 */
export function parseTurmaSearch(raw: string | null): { value: string; valid: boolean } {
  const original = (raw ?? "").trim();
  const value = original.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return { value, valid: original.length <= 80 && (!original || Boolean(value)) };
}
