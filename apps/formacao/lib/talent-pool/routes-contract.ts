export type MatchInsertErrorInput = {
  code?: string | null;
  message?: string | null;
};

export type MatchInsertErrorContract = {
  status: number;
  body: {
    ok: false;
    code?: "MATCH_DUPLICADO" | "CONTA_NAO_VERIFICADA";
    error: string;
  };
};

function isRlsDenied(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("new row violates row-level security")
  );
}

export function classifyMatchInsertError(error: MatchInsertErrorInput): MatchInsertErrorContract {
  const code = String(error.code ?? "").trim();
  const message = String(error.message ?? "").trim();

  if (code === "23505") {
    return {
      status: 409,
      body: {
        ok: false,
        code: "MATCH_DUPLICADO",
        error: "Ja existe uma solicitacao ativa para este talento.",
      },
    };
  }

  if (isRlsDenied(message)) {
    return {
      status: 403,
      body: {
        ok: false,
        code: "CONTA_NAO_VERIFICADA",
        error: "Conta empresarial em validacao. Ativacao prevista em 2-4 horas.",
      },
    };
  }

  return {
    status: 400,
    body: {
      ok: false,
      error: message || "Falha ao criar solicitacao de entrevista.",
    },
  };
}

export function parseCandidatesQuery(requestUrl: string): { limit: number; search: string } {
  const url = new URL(requestUrl);
  const limitParam = Number(url.searchParams.get("limit") ?? "6");
  const search = String(url.searchParams.get("q") ?? "")
    .trim()
    .toLowerCase();
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 6, 1), 20);
  return { limit, search };
}

export function buildEmpresaStatusProfile(data: unknown, userId: string) {
  const row = (data ?? null) as
    | {
        id?: unknown;
        nif?: unknown;
        dominio_email?: unknown;
        is_verified?: unknown;
        created_at?: unknown;
        updated_at?: unknown;
      }
    | null;

  if (!row) {
    return {
      id: userId,
      nif: null,
      dominio_email: null,
      is_verified: false,
      created_at: null,
      updated_at: null,
    };
  }

  return {
    id: typeof row.id === "string" ? row.id : userId,
    nif: typeof row.nif === "string" ? row.nif : null,
    dominio_email: typeof row.dominio_email === "string" ? row.dominio_email : null,
    is_verified: row.is_verified === true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}
