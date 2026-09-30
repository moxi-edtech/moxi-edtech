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

export type AcademicYearScope = {
  id: string;
  ano: number;
  dataInicio: string | null;
  dataFim: string | null;
  status: AcademicYearStatus;
  warnings?: string[];
};

export type ResolveAcademicYearScopeInput = {
  escolaId: string;
  requestedAcademicYearId?: string | null;
  requestedYear?: number | null;
  operation?: "READ" | "WRITE";
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

export async function resolveAcademicYearScope(
  supabase: SupabaseClient,
  input: ResolveAcademicYearScopeInput,
): Promise<AcademicYearScope> {
  const requestedId = input.requestedAcademicYearId?.trim() || null;
  const requestedYear = input.requestedYear == null ? null : Number(input.requestedYear);
  const operation = input.operation ?? "READ";

  if (operation === "WRITE" && !requestedId) {
    throw new AcademicYearContextError("ACADEMIC_YEAR_REQUIRED", 400, "ano_letivo_id é obrigatório para operações de escrita.");
  }

  let query = supabase
    .from("anos_letivos")
    .select("id, ano, data_inicio, data_fim, ativo")
    .eq("escola_id", input.escolaId);
  if (requestedId) query = query.eq("id", requestedId);
  else if (Number.isInteger(requestedYear)) query = query.eq("ano", requestedYear);
  else query = query.eq("ativo", true);

  const { data, error } = await query
    .order("data_inicio", { ascending: false, nullsFirst: false })
    .order("ano", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    const requested = Boolean(requestedId || Number.isInteger(requestedYear));
    throw new AcademicYearContextError(
      requested ? "ACADEMIC_YEAR_NOT_FOUND" : "ACTIVE_ACADEMIC_YEAR_NOT_CONFIGURED",
      requested ? 404 : 409,
      requested ? "Ano letivo não encontrado." : "A escola não possui um ano letivo ativo configurado.",
    );
  }

  const row = rows[0] as AcademicYearRow;
  const year = toYear(row.ano);
  if (!year) throw new AcademicYearContextError("ACADEMIC_YEAR_NOT_FOUND", 404, "Ano letivo inválido.");
  const status = getAcademicYearStatus(row);
  if (operation === "WRITE" && status !== "ACTIVE") {
    throw new AcademicYearContextError("ACADEMIC_YEAR_CLOSED", 409, "O ano letivo selecionado não permite escrita.");
  }

  return {
    id: String(row.id),
    ano: year,
    dataInicio: row.data_inicio ? String(row.data_inicio) : null,
    dataFim: row.data_fim ? String(row.data_fim) : null,
    status,
    warnings: !requestedId && rows.length > 1 ? ["MULTIPLE_ACTIVE_ACADEMIC_YEARS"] : [],
  };
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

  const scope = await resolveAcademicYearScope(supabase, {
    escolaId,
    requestedAcademicYearId: requestedId,
    operation: input.operation,
  });

  return {
    escolaId,
    anoLetivoId: scope.id,
    anoLetivoLabel: labelForYear(scope.ano),
    status: scope.status,
    mode: scope.status === "ACTIVE" ? "CURRENT" : "HISTORICAL_READ",
    timezone: DEFAULT_SCHOOL_TIMEZONE,
    resolvedFrom: requestedId ? "URL" : "ACTIVE_DEFAULT",
    warnings: scope.warnings,
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
