import { NextResponse } from "next/server";

export type ExplorerRouteName =
  | "curso" | "classe" | "turma" | "professor" | "disciplina"
  | "roster-search" | "roster-export" | "disciplina-search" | "student-capabilities";

const ERROR_CODES: Record<number, string> = {
  400: "INVALID_REQUEST",
  401: "SESSION_EXPIRED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  503: "SERVICE_UNAVAILABLE",
};

const FALLBACK_ERRORS: Record<number, string> = {
  400: "Os parâmetros desta consulta são inválidos.",
  401: "A sessão terminou. Inicie sessão novamente para continuar.",
  403: "Não tem autorização para consultar este conteúdo.",
  404: "Este conteúdo não está disponível no âmbito seleccionado.",
  409: "Os dados mudaram. Actualize a consulta antes de continuar.",
  429: "Foram feitas demasiadas consultas. Tente novamente mais tarde.",
  503: "Este serviço está temporariamente indisponível.",
};

// Only these static business-code messages can cross the error boundary. Never
// relay raw SQL, user input, document numbers or untrusted exception messages.
const SAFE_BUSINESS_FAILURES: Record<string, {
  route: ExplorerRouteName; status: number; message: string;
}> = {
  EXPORT_DISABLED: {
    route: "roster-export", status: 403,
    message: "Exportação de listas desactivada nesta escola. Solicite autorização à administração.",
  },
  POLO_SCOPE_UNDEFINED: {
    route: "roster-search", status: 403,
    message: "A consulta por polo ainda não está disponível. Solicite à administração a definição dos acessos por polo.",
  },
  HISTORIC_ROSTER_UNAVAILABLE: {
    route: "roster-search", status: 409,
    message: "A pesquisa de matrículas históricas aguarda homologação. Escolha um ano letivo activo.",
  },
};

function codeForStatus(status: number): string {
  return ERROR_CODES[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
}

/**
 * Um só ID por requisição, inclusive respostas 401/403 e falhas inesperadas.
 * Nunca registar nomes, termos, IDs de aluno, documentos, valores ou erros SQL.
 */
export async function withExplorerObservability(
  route: ExplorerRouteName,
  execute: () => Promise<Response>,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = performance.now();
  const attachTiming = (headers: Headers) => {
    const durationMs = Math.max(0, performance.now() - startedAt);
    // Expose aggregate endpoint timing to browser RUM without adding an
    // external request, background polling or a student identifier.
    headers.set("Server-Timing", `cc;dur=${durationMs.toFixed(1)}`);
    return durationMs;
  };
  try {
    const result = await execute();
    const headers = new Headers(result.headers);
    headers.set("X-Correlation-ID", requestId);
    headers.set("Cache-Control", "private, no-store");
    attachTiming(headers);
    if (result.ok) {
      return new Response(result.body, { status: result.status, headers });
    }

    const body = await result.clone().json().catch(() => null) as { code?: unknown } | null;
    const claimedCode = typeof body?.code === "string" ? body.code : "";
    const safe = Object.prototype.hasOwnProperty.call(SAFE_BUSINESS_FAILURES, claimedCode)
      ? SAFE_BUSINESS_FAILURES[claimedCode] : undefined;
    const match = safe?.route === route && safe.status === result.status ? safe : null;
    const code = match ? claimedCode : codeForStatus(result.status);
    console[result.status >= 500 ? "error" : "warn"](
      "[command-center] request rejected", { route, code, status: result.status, requestId },
    );

    // Never relay untrusted exception details from the old API to the browser.
    // The error message is a small, status-specific human-readable contract.
    return NextResponse.json({
      ok: false,
      error: match?.message ?? FALLBACK_ERRORS[result.status] ?? "Não foi possível concluir esta consulta.",
      code,
      requestId,
    }, { status: result.status, headers });
  } catch {
    console.error("[command-center] unexpected read failure", {
      route, code: "INTERNAL_ERROR", status: 500, requestId,
    });
    const headers = new Headers({ "X-Correlation-ID": requestId, "Cache-Control": "private, no-store" });
    attachTiming(headers);
    return NextResponse.json({
      ok: false,
      error: "Ocorreu um problema ao consultar os dados. Tente novamente.",
      code: "INTERNAL_ERROR",
      requestId,
    }, { status: 500, headers });
  }
}
