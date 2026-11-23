/** Consulta documental: o ano civil representa o início do ano letivo (2025 = 2025/2026). */
export const HISTORICAL_DISCIPLINES_PAGE_SIZE = 25;

export type HistoricalDisciplineQuery =
  | { ok: true; year: number; page: number }
  | { ok: false; error: string };

export function parseHistoricalDisciplineQuery(params: URLSearchParams): HistoricalDisciplineQuery {
  const rawYear = params.get("ano") ?? "";
  const rawPage = params.get("page") ?? "1";
  if (!/^(19|20)\d{2}$/.test(rawYear)) {
    return { ok: false, error: "Ano letivo inválido." };
  }
  if (!/^[1-9]\d{0,3}$/.test(rawPage)) {
    return { ok: false, error: "Página inválida." };
  }
  const year = Number(rawYear);
  const page = Number(rawPage);
  if (year > 2100 || page > 1000) {
    return { ok: false, error: "Ano ou página fora do intervalo." };
  }
  return { ok: true, year, page };
}
