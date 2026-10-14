/**
 * The grading desk must query the canonical turmas table, scoped to the
 * verified academic session. The admission-only materialized view filters
 * additional enrolment criteria and is not a source of truth for grades.
 */
export type GradeTurma = {
  id: string;
  nome: string | null;
  turno: string | null;
};

type GradeClassQuery = {
  select: (columns: string) => GradeClassQuery;
  eq: (column: string, value: string) => GradeClassQuery;
  order: (column: string, opts: { ascending: boolean }) => GradeClassQuery;
  range: (from: number, to: number) => PromiseLike<{
    data: GradeTurma[] | null;
    error: { message: string } | null;
  }>;
};

type GradeClassSource = {
  from: (table: "turmas") => { select: (columns: "id,nome,turno") => GradeClassQuery };
};

export const GRADE_TURMAS_PAGE_SIZE = 100;
export const MAX_GRADE_TURMAS_OFFSET = 10_000;

export async function listGradeTurmas(
  source: GradeClassSource,
  escolaId: string,
  anoLetivoId: string,
  offset = 0,
): Promise<{ items: GradeTurma[]; has_more: boolean }> {
  if (!escolaId || !anoLetivoId) throw new Error("Escola e ano letivo são obrigatórios");
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_GRADE_TURMAS_OFFSET) {
    throw new Error("Página de turmas inválida");
  }

  // One extra row determines whether the next page exists. Never query
  // another tenant or a calendar year derived from the device clock.
  const { data, error } = await source
    .from("turmas")
    .select("id,nome,turno")
    .eq("escola_id", escolaId)
    .eq("session_id", anoLetivoId)
    .order("nome", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + GRADE_TURMAS_PAGE_SIZE);

  if (error) throw new Error("Não foi possível consultar as turmas para lançamento.");
  const rows = data ?? [];
  return {
    items: rows.slice(0, GRADE_TURMAS_PAGE_SIZE),
    has_more: rows.length > GRADE_TURMAS_PAGE_SIZE,
  };
}

type GradeTurmaResponse = {
  ok?: boolean;
  error?: string;
  items?: GradeTurma[];
  has_more?: boolean;
  ano_letivo_id?: string;
};

/**
 * Client counterpart of the scoped server paginator. Unlike the old
 * dropdown, it never silently truncates classes at the first 50 rows.
 */
export async function loadAllGradeTurmas(
  fetcher: (input: string, init: { cache: "no-store" }) => Promise<{
    ok: boolean;
    json: () => Promise<GradeTurmaResponse>;
  }>,
  anoLetivoId: string,
): Promise<GradeTurma[]> {
  if (!anoLetivoId) throw new Error("Ano letivo não identificado.");
  let offset = 0;
  let hasMore = true;
  const turmas: GradeTurma[] = [];

  while (hasMore) {
    const params = new URLSearchParams({
      ano_letivo_id: anoLetivoId,
      offset: String(offset),
    });
    const response = await fetcher("/api/secretaria/notas/turmas?" + params.toString(), {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({} as GradeTurmaResponse));
    if (!response.ok || !payload.ok || !Array.isArray(payload.items)) {
      throw new Error(payload.error || "Não foi possível listar as turmas.");
    }
    if (payload.ano_letivo_id !== anoLetivoId) {
      throw new Error("A listagem pertence a outro ano letivo.");
    }
    turmas.push(...payload.items);
    hasMore = payload.has_more === true;
    if (hasMore && payload.items.length !== GRADE_TURMAS_PAGE_SIZE) {
      throw new Error("Listagem incompleta de turmas. Tente novamente.");
    }
    offset += payload.items.length;
    if (hasMore && offset > MAX_GRADE_TURMAS_OFFSET) {
      throw new Error("A escola excedeu o limite de turmas para listagem.");
    }
  }

  return turmas;
}
