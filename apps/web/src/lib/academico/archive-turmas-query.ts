/**
 * Contrato puro da consulta histórica por turma. O servidor acrescenta
 * obrigatoriamente escola_id e session_id autorizados; nunca confiar no ano civil.
 */
export const ARCHIVE_TURMAS_PAGE_SIZE = 25;

export type ArchiveTurmasFilters = {
  academicYearId: string;
  page: number;
  q: string;
};

export type ArchiveTurmasFiltersResult =
  | { ok: true; value: ArchiveTurmasFilters }
  | { ok: false; status: 400 | 403; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseArchiveTurmasQuery(params: URLSearchParams): ArchiveTurmasFiltersResult {
  if (params.has("polo_id") || params.has("poloId")) {
    return { ok: false, status: 403, error: "Consulta por polo indisponível sem escopo canónico." };
  }
  const academicYearId = params.get("ano_letivo_id")?.trim() ?? "";
  if (!UUID.test(academicYearId)) {
    return { ok: false, status: 400, error: "Ano letivo válido obrigatório." };
  }
  const rawPage = params.get("page") ?? "1";
  if (!/^[1-9]\d{0,4}$/.test(rawPage)) {
    return { ok: false, status: 400, error: "Página inválida." };
  }
  const page = Number(rawPage);
  if (page > 10000) {
    return { ok: false, status: 400, error: "Página inválida." };
  }
  const q = (params.get("q") ?? "").trim();
  if (q.length > 80) {
    return { ok: false, status: 400, error: "Pesquisa demasiado longa." };
  }
  return { ok: true, value: { academicYearId, page, q } };
}

/** Escape de literais LIKE, sem criar filtros PostgREST 'or' com texto do utilizador. */
export function literalIlikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, "\\$&")}%`;
}
