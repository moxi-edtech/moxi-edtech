/**
 * Numeric class metadata is nullable for legacy schools. Never coerce null
 * or an empty string to 0: that would incorrectly classify all grades as
 * Pré-Escolar and could expose invalid destination classes.
 */
export function resolveClasseNumero(
  classe: { numero?: number | string | null; nome?: string | null } | null | undefined,
): number | null {
  if (!classe) return null;

  const raw = classe.numero;
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 13) return parsed;
  }

  const nome = String(classe.nome ?? "").trim();
  if (/^pré[\s-]*escolar$/i.test(nome)) return 0;

  const match = nome.match(/^(\d{1,2})\s*(?:ª|º|a|o)?\s*(?:classe|ano)?$/i);
  const derived = match ? Number(match[1]) : null;
  return derived !== null && derived >= 1 && derived <= 13 ? derived : null;
}
