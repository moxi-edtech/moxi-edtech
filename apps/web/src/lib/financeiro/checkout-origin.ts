/**
 * In post-rollover collections each monthly charge belongs to its own
 * historical matrícula. Never substitute the currently selected matrícula
 * when the checkout item supplies its original one.
 *
 * The canonical payment API rechecks this ID against mensalidades.matricula_id.
 */
export function resolveCheckoutOriginMatricula(input: {
  tipo: "mensalidade" | "servico";
  origemMatriculaId?: string | null;
  matriculaId?: string | null;
}): string | null {
  if (input.tipo !== "mensalidade") return null;
  return input.origemMatriculaId ?? input.matriculaId ?? null;
}
