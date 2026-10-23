/** A school employee lookup must not send an academic login to staff management.
 * The DB may index both the student's identity and their login membership.
 * Never collapse by name: two real students may share the same name.
 * This is UI classification only; server-side school authorization is unchanged.
 */
export function visibleSearchResults<T extends { type: string; highlight: string | null }>(
  rows: readonly T[],
  portal: string | undefined,
): T[] {
  if (portal !== "admin" && portal !== "operacoes") return [...rows];
  return rows.filter((row) => {
    if (row.type !== "usuario") return true;
    const role = row.highlight?.trim().toLowerCase() ?? "";
    return role !== "aluno" && role !== "professor";
  });
}
