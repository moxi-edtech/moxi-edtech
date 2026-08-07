import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const ACADEMIC_YEAR_PARAM = "ano_letivo_id";
export const DEFAULT_SCHOOL_TIMEZONE = "Africa/Luanda";
export const ACADEMIC_CONTEXT_TIMEOUT_MS = 5_000;
export const ACADEMIC_CONTEXT_STALE_TIME_MS = 0;

export type AcademicYearStatus = "PLANNED" | "ACTIVE" | "CLOSED";
export type AcademicWorkspaceMode = "CURRENT" | "HISTORICAL_READ";
export type AcademicWorkspaceContext = {
  escolaId: string;
  anoLetivoId: string;
  anoLetivoLabel: string;
  status: AcademicYearStatus;
  mode: AcademicWorkspaceMode;
  timezone: string;
  resolvedFrom: "URL" | "ACTIVE_DEFAULT";
  warnings?: string[];
};

export type ResolveAcademicYearContextInput = {
  userId: string;
  requestedAcademicYearId?: string | null;
  operation: "READ" | "WRITE";
};

export class AcademicYearContextError extends Error {
  readonly code:
    | "ACADEMIC_YEAR_REQUIRED"
    | "ACADEMIC_YEAR_NOT_FOUND"
    | "ACADEMIC_YEAR_CLOSED"
    | "ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED"
    | "ACADEMIC_CONTEXT_TIMEOUT"
    | "CROSS_YEAR_ENTITY_MISMATCH"
    | "ACADEMIC_ENTITY_NOT_FOUND";
  readonly status: 400 | 404 | 409 | 503;

  constructor(
    code: AcademicYearContextError["code"],
    status: AcademicYearContextError["status"],
    message: string,
  ) {
    super(message);
    this.name = "AcademicYearContextError";
    this.code = code;
    this.status = status;
  }
}

type AcademicYearRow = {
  id: string;
  ano: number | string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean | null;
};

function toYear(value: AcademicYearRow["ano"]): number | null {
  const year = typeof value === "string" ? Number(value) : value;
  return typeof year === "number" && Number.isInteger(year) && year >= 1900 && year <= 3000 ? year : null;
}

export function getAcademicYearStatus(
  row: Pick<AcademicYearRow, "ativo" | "data_inicio">,
  now = new Date(),
): AcademicYearStatus {
  if (row.ativo === true) return "ACTIVE";
  if (row.data_inicio && new Date(`${row.data_inicio}T00:00:00Z`) > now) return "PLANNED";
  return "CLOSED";
}

function labelForYear(year: number) {
  return `${year}/${year + 1}`;
}

async function resolveAcademicYearContextUnbounded(
  supabase: SupabaseClient,
  input: ResolveAcademicYearContextInput,
): Promise<AcademicWorkspaceContext> {
  const requestedId = input.requestedAcademicYearId?.trim() || null;

  if (input.operation === "WRITE" && !requestedId) {
    throw new AcademicYearContextError(
      "ACADEMIC_YEAR_REQUIRED",
      400,
      "ano_letivo_id é obrigatório para operações de escrita.",
    );
  }

  const escolaId = await resolveEscolaIdForUser(supabase, input.userId);
  if (!escolaId) {
    throw new AcademicYearContextError(
      "ACADEMIC_YEAR_NOT_FOUND",
      404,
      "Ano letivo não encontrado.",
    );
  }

  let query = supabase
    .from("anos_letivos")
    .select("id, ano, data_inicio, data_fim, ativo")
    .eq("escola_id", escolaId);

  query = requestedId ? query.eq("id", requestedId) : query.eq("ativo", true);

  const activeQuery = requestedId
    ? query.limit(1).maybeSingle()
    : query
        .order("data_inicio", { ascending: false, nullsFirst: false })
        .limit(10);
  const { data, error } = await activeQuery;
  if (error) throw error;

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    if (requestedId) {
      // Deliberately use the same response for an unknown or cross-tenant id.
      throw new AcademicYearContextError(
        "ACADEMIC_YEAR_NOT_FOUND",
        404,
        "Ano letivo não encontrado.",
      );
    }
    throw new AcademicYearContextError(
      "ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED",
      409,
      "A escola não possui um ano letivo ativo configurado.",
    );
  }

  let warnings = !requestedId && rows.length > 1
    ? ["MULTIPLE_ACTIVE_ACADEMIC_YEARS"]
    : [];
  if (requestedId) {
    const { data: activeRows, error: activeRowsError } = await supabase
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ativo", true);
    if (activeRowsError) throw activeRowsError;
    if ((activeRows ?? []).length > 1) warnings = ["MULTIPLE_ACTIVE_ACADEMIC_YEARS"];
  }
  if (warnings.length > 0) {
    console.warn("[academic-context] Mais de um ano ACTIVE encontrado; usando o de início mais recente", {
      escolaId,
      academicYearIds: rows.map((row) => String((row as AcademicYearRow).id)),
    });
  }

  const row = rows[0] as AcademicYearRow;
  const year = toYear(row.ano);
  if (!year) {
    throw new AcademicYearContextError(
      "ACADEMIC_YEAR_NOT_FOUND",
      404,
      "Ano letivo inválido.",
    );
  }

  const status = getAcademicYearStatus(row);
  if (input.operation === "WRITE" && status !== "ACTIVE") {
    throw new AcademicYearContextError(
      "ACADEMIC_YEAR_CLOSED",
      409,
      "O ano letivo selecionado não permite escrita.",
    );
  }

  return {
    escolaId,
    anoLetivoId: String(row.id),
    anoLetivoLabel: labelForYear(year),
    status,
    mode: status === "ACTIVE" ? "CURRENT" : "HISTORICAL_READ",
    timezone: DEFAULT_SCHOOL_TIMEZONE,
    resolvedFrom: requestedId ? "URL" : "ACTIVE_DEFAULT",
    warnings,
  };
}

export async function resolveAcademicYearContext(
  supabase: SupabaseClient,
  input: ResolveAcademicYearContextInput,
): Promise<AcademicWorkspaceContext> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new AcademicYearContextError(
      "ACADEMIC_CONTEXT_TIMEOUT",
      503,
      "Não foi possível carregar o contexto académico. Tente novamente.",
    )), ACADEMIC_CONTEXT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      resolveAcademicYearContextUnbounded(supabase, input),
      timeout,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function assertAcademicYearEntity(
  supabase: SupabaseClient,
  input: {
    table: "turmas" | "matriculas";
    entityId: string;
    escolaId: string;
    anoLetivoId: string;
  },
) {
  const { data, error } = await supabase
    .from(input.table)
    .select("escola_id, session_id")
    .eq("id", input.entityId)
    .eq("escola_id", input.escolaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new AcademicYearContextError(
      "ACADEMIC_ENTITY_NOT_FOUND",
      404,
      "Entidade académica não encontrada.",
    );
  }
  if (String(data.session_id ?? "") !== input.anoLetivoId) {
    throw new AcademicYearContextError(
      "CROSS_YEAR_ENTITY_MISMATCH",
      409,
      "A entidade não pertence ao ano letivo selecionado.",
    );
  }
  return data;
}
