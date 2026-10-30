import type {
  PendenciaFechamento,
  RelatorioSanidadeFechamento,
} from "@/app/api/secretaria/fechamento-academico/validacoes/types";

/**
 * Fecho académico is an irreversible operation. The database row, not an
 * Inngest event payload, is the source of its scope and approved exceptions.
 */
export class FechamentoExecutionError extends Error {
  readonly status = 409;
  readonly code = "ACADEMIC_CLOSURE_EXECUTION_BLOCKED";
  constructor(message: string) {
    super(message);
    this.name = "FechamentoExecutionError";
  }
}

export type FechamentoJobSnapshot = {
  run_id: string;
  escola_id: string;
  executor_user_id: string | null;
  fechamento_tipo: string;
  estado: string;
  ano_letivo_id: string;
  periodo_letivo_id: string | null;
  turma_ids: string[] | null;
  matricula_ids: string[] | null;
  parametros: unknown;
};

export type FechamentoStoredParameters = {
  motivo?: string;
  permitir_reaberto_override?: boolean;
  approved_critical_keys?: string[];
};

export function closureCriticalKey(
  entry: Pick<PendenciaFechamento, "regra" | "turma_id" | "matricula_id" | "aluno_id">,
): string {
  return JSON.stringify([
    entry.regra,
    entry.turma_id ?? null,
    entry.matricula_id ?? null,
    entry.aluno_id ?? null,
  ]);
}

/** Only the exact critical findings approved by the POST preflight survive dispatch. */
export function approvedClosureCriticalKeys(
  preflight: RelatorioSanidadeFechamento,
  approvedIds: readonly string[],
): string[] {
  const critical = preflight.pendencias.filter((entry) => entry.severidade === "CRITICAL");
  const ids = new Set(approvedIds);
  if (critical.some((entry) => !entry.pode_excecao || !ids.has(entry.id))) {
    throw new FechamentoExecutionError("Existem pendências críticas sem autorização de exceção.");
  }
  return [...new Set(critical.map(closureCriticalKey))].sort();
}

/** Called again inside the executor, before the first mutation. */
export function assertAuthorizedClosurePreflight(
  preflight: RelatorioSanidadeFechamento,
  approvedKeys: readonly string[] = [],
): void {
  const allowed = new Set(approvedKeys);
  const critical = preflight.pendencias.filter((entry) => entry.severidade === "CRITICAL");
  if (critical.some((entry) => !entry.pode_excecao || !allowed.has(closureCriticalKey(entry)))) {
    throw new FechamentoExecutionError(
      "O fecho foi bloqueado: há pendências académicas novas ou não autorizadas.",
    );
  }
}

export type VerifiedClosureExecution = {
  runId: string;
  escolaId: string;
  executorUserId: string;
  acao: "fechar_trimestre" | "fechar_ano";
  anoLetivoId: string;
  periodoLetivoId?: string;
  turmaIds: string[];
  matriculaIds: string[];
  motivo?: string;
  allowReabertoOverride: boolean;
  approvedCriticalKeys: string[];
};

export function resolveVerifiedClosureExecution(
  job: FechamentoJobSnapshot,
  request: {
    runId: string;
    escolaId: string;
    executorUserId: string;
    authenticatedUserId: string;
  },
): VerifiedClosureExecution {
  if (!job || job.run_id !== request.runId || job.escola_id !== request.escolaId ||
      !job.executor_user_id ||
      job.executor_user_id !== request.executorUserId ||
      job.executor_user_id !== request.authenticatedUserId ||
      job.estado !== "PENDING_VALIDATION") {
    throw new FechamentoExecutionError("Execução não autorizada ou já iniciada.");
  }
  if (job.fechamento_tipo !== "fechar_trimestre" && job.fechamento_tipo !== "fechar_ano") {
    throw new FechamentoExecutionError("Tipo de fecho inválido.");
  }
  if (!job.ano_letivo_id ||
      (job.fechamento_tipo === "fechar_trimestre" && !job.periodo_letivo_id) ||
      (job.fechamento_tipo === "fechar_ano" && job.periodo_letivo_id)) {
    throw new FechamentoExecutionError("Ano ou período do fecho incompatível.");
  }
  const params: FechamentoStoredParameters =
    job.parametros && typeof job.parametros === "object" && !Array.isArray(job.parametros)
      ? job.parametros as FechamentoStoredParameters
      : {};
  if (params.approved_critical_keys !== undefined &&
      (!Array.isArray(params.approved_critical_keys) ||
        params.approved_critical_keys.some((value) => typeof value !== "string"))) {
    throw new FechamentoExecutionError("Autorizações de exceção inválidas.");
  }
  return {
    runId: job.run_id,
    escolaId: job.escola_id,
    executorUserId: job.executor_user_id,
    acao: job.fechamento_tipo,
    anoLetivoId: job.ano_letivo_id,
    periodoLetivoId: job.periodo_letivo_id ?? undefined,
    turmaIds: job.turma_ids ?? [],
    matriculaIds: job.matricula_ids ?? [],
    motivo: params.motivo,
    allowReabertoOverride: params.permitir_reaberto_override === true,
    approvedCriticalKeys: params.approved_critical_keys ?? [],
  };
}
