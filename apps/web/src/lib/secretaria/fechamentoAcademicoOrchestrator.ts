import { executarValidacoesFechamento } from "@/app/api/secretaria/fechamento-academico/validacoes/engine";

export const ESTADOS_FECHAMENTO = {
  PENDING_VALIDATION: "PENDING_VALIDATION",
  CLOSING_PERIOD: "CLOSING_PERIOD",
  FINALIZING_ENROLLMENTS: "FINALIZING_ENROLLMENTS",
  GENERATING_HISTORY: "GENERATING_HISTORY",
  OPENING_NEXT_PERIOD: "OPENING_NEXT_PERIOD",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

export type EstadoFechamento = (typeof ESTADOS_FECHAMENTO)[keyof typeof ESTADOS_FECHAMENTO];

type SupabaseClient = any;

export async function insertStep(
  supabase: SupabaseClient,
  payload: {
    run_id: string;
    escola_id: string;
    executor_user_id: string;
    etapa: EstadoFechamento;
    status: "STARTED" | "DONE" | "FAILED";
    contexto?: Record<string, unknown>;
    error_message?: string | null;
  }
) {
  await supabase.from("fechamento_academico_job_steps").insert({
    run_id: payload.run_id,
    escola_id: payload.escola_id,
    executor_user_id: payload.executor_user_id,
    etapa: payload.etapa,
    status: payload.status,
    contexto: payload.contexto ?? {},
    error_message: payload.error_message ?? null,
  });

  await supabase.from("audit_logs").insert({
    escola_id: payload.escola_id,
    actor_id: payload.executor_user_id,
    action: "FECHAMENTO_ACADEMICO_STEP",
    entity: "fechamento_academico_jobs",
    entity_id: payload.run_id,
    portal: "secretaria",
    details: {
      etapa: payload.etapa,
      status: payload.status,
      ...(payload.contexto ?? {}),
      ...(payload.error_message ? { error: payload.error_message } : {}),
    },
  });
}

export async function setJobState(
  supabase: SupabaseClient,
  runId: string,
  estado: EstadoFechamento,
  patch?: Record<string, unknown>
) {
  await supabase
    .from("fechamento_academico_jobs")
    .update({ estado, updated_at: new Date().toISOString(), ...(patch ?? {}) })
    .eq("run_id", runId);
}

export async function runFechamentoOrchestration(params: {
  supabase: SupabaseClient;
  runId: string;
  escolaId: string;
  executorUserId: string;
  acao: "fechar_trimestre" | "fechar_ano";
  anoLetivoId: string;
  periodoLetivoId?: string;
  turmaIds: string[];
  matriculaIds: string[];
  motivo?: string;
  allowReabertoOverride?: boolean;
}) {
  const { supabase, runId, escolaId, executorUserId, acao, anoLetivoId, periodoLetivoId, turmaIds } = params;

  const preflight = await executarValidacoesFechamento({
    supabase,
    escolaId,
    acao,
    anoLetivoId,
    periodoLetivoId,
    turmaIds,
    runId,
    allowReabertoOverride: params.allowReabertoOverride,
  });

  const legalSnapshotBlockers = preflight.pendencias.filter((p) => p.regra === "SNAPSHOT_LEGAL_CONFLITO");
  if (legalSnapshotBlockers.length > 0) {
    await setJobState(supabase, runId, ESTADOS_FECHAMENTO.FAILED, {
      finished_at: new Date().toISOString(),
      errors: legalSnapshotBlockers.map((p) => ({
        stage: ESTADOS_FECHAMENTO.PENDING_VALIDATION,
        matricula_id: p.matricula_id,
        error: p.mensagem,
      })),
      relatorio_preflight: preflight,
    });

    throw new Error("Snapshot legal já congelado para uma ou mais matrículas. Reabertura auditada é obrigatória.");
  }

  let matriculaIds = [...params.matriculaIds];

  await setJobState(supabase, runId, ESTADOS_FECHAMENTO.CLOSING_PERIOD);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.CLOSING_PERIOD,
    status: "STARTED",
    contexto: { turma_ids: turmaIds, periodo_letivo_id: periodoLetivoId ?? null },
  });

  const fechamentoErrors: Array<{ stage: string; turma_id?: string; matricula_id?: string; error: string }> = [];
  if (acao === "fechar_trimestre") {
    if (!periodoLetivoId) throw new Error("periodo_letivo_id é obrigatório para fechar_trimestre.");
    for (const turmaId of turmaIds) {
      const { error } = await supabase.rpc("fechar_periodo_academico", {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_periodo_letivo_id: periodoLetivoId,
      });
      if (error) fechamentoErrors.push({ stage: ESTADOS_FECHAMENTO.CLOSING_PERIOD, turma_id: turmaId, error: error.message });
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.CLOSING_PERIOD,
    status: fechamentoErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_turmas: fechamentoErrors.filter((x) => x.turma_id).length },
    error_message: fechamentoErrors.length > 0 ? "Falha ao fechar uma ou mais turmas." : null,
  });

  await setJobState(supabase, runId, ESTADOS_FECHAMENTO.FINALIZING_ENROLLMENTS);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.FINALIZING_ENROLLMENTS,
    status: "STARTED",
  });

  if (matriculaIds.length === 0) {
    let matriculasQuery = supabase
      .from("matriculas")
      .select("id,turma_id")
      .eq("escola_id", escolaId)
      .eq("ano_letivo", (await supabase.from("anos_letivos").select("ano").eq("escola_id", escolaId).eq("id", anoLetivoId).single()).data?.ano ?? -1);
    if (turmaIds.length > 0) matriculasQuery = matriculasQuery.in("turma_id", turmaIds);
    const { data: matriculas, error: matriculasError } = await matriculasQuery;
    if (matriculasError) throw matriculasError;
    matriculaIds = (matriculas ?? []).map((m: any) => m.id as string);
  }

  const finalizeErrors: Array<{ stage: string; turma_id?: string; matricula_id?: string; error: string }> = [];
  for (const matriculaId of matriculaIds) {
    const { error } = await supabase.rpc("finalizar_matricula_blindada", {
      p_escola_id: escolaId,
      p_matricula_id: matriculaId,
      p_motivo: params.motivo ?? "Fechamento acadêmico automático.",
      p_is_override_manual: false,
      p_status_override: null,
    });
    if (error) finalizeErrors.push({ stage: ESTADOS_FECHAMENTO.FINALIZING_ENROLLMENTS, matricula_id: matriculaId, error: error.message });
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.FINALIZING_ENROLLMENTS,
    status: finalizeErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_matriculas: finalizeErrors.length, total_matriculas: matriculaIds.length },
    error_message: finalizeErrors.length > 0 ? "Falha ao finalizar uma ou mais matrículas." : null,
  });

  await setJobState(supabase, runId, ESTADOS_FECHAMENTO.GENERATING_HISTORY);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.GENERATING_HISTORY,
    status: "STARTED",
  });

  const historyErrors: Array<{ stage: string; turma_id?: string; matricula_id?: string; error: string }> = [];
  for (const matriculaId of matriculaIds) {
    const { error } = await supabase.rpc("gerar_historico_anual", { p_matricula_id: matriculaId });
    if (error) historyErrors.push({ stage: ESTADOS_FECHAMENTO.GENERATING_HISTORY, matricula_id: matriculaId, error: error.message });
  }

  if (historyErrors.length === 0 && matriculaIds.length > 0) {
    const { error: snapshotLockError } = await supabase.rpc("historico_set_snapshot_state", {
      p_escola_id: escolaId,
      p_matricula_ids: matriculaIds,
      p_ano_letivo_id: anoLetivoId,
      p_novo_estado: "fechado",
      p_motivo: params.motivo ?? "Congelamento legal após geração do histórico.",
      p_run_id: runId,
    });
    if (snapshotLockError) {
      historyErrors.push({ stage: ESTADOS_FECHAMENTO.GENERATING_HISTORY, error: `Falha ao congelar snapshot legal: ${snapshotLockError.message}` });
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.GENERATING_HISTORY,
    status: historyErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_matriculas: historyErrors.length },
    error_message: historyErrors.length > 0 ? "Falha ao gerar histórico anual de uma ou mais matrículas." : null,
  });

  await setJobState(supabase, runId, ESTADOS_FECHAMENTO.OPENING_NEXT_PERIOD);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.OPENING_NEXT_PERIOD,
    status: "STARTED",
  });

  if (acao === "fechar_trimestre" && periodoLetivoId) {
    const { data: currentPeriod } = await supabase
      .from("periodos_letivos")
      .select("numero,tipo")
      .eq("escola_id", escolaId)
      .eq("id", periodoLetivoId)
      .single();

    if (currentPeriod?.numero) {
      await supabase
        .from("periodos_letivos")
        .update({ trava_notas_em: null })
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", anoLetivoId)
        .eq("tipo", currentPeriod.tipo)
        .eq("numero", Number(currentPeriod.numero) + 1);
    }
  } else {
    const { data: currentYear } = await supabase.from("anos_letivos").select("ano").eq("escola_id", escolaId).eq("id", anoLetivoId).single();
    if (currentYear?.ano) {
      const { data: nextYear } = await supabase
        .from("anos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano", Number(currentYear.ano) + 1)
        .maybeSingle();
      if (nextYear?.id) {
        await supabase.from("anos_letivos").update({ ativo: false }).eq("escola_id", escolaId).eq("id", anoLetivoId);
        await supabase.from("anos_letivos").update({ ativo: true }).eq("escola_id", escolaId).eq("id", nextYear.id);
      }
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS_FECHAMENTO.OPENING_NEXT_PERIOD,
    status: "DONE",
  });

  const allErrors = [...fechamentoErrors, ...finalizeErrors, ...historyErrors];
  const failed = allErrors.length > 0;
  await setJobState(supabase, runId, failed ? ESTADOS_FECHAMENTO.FAILED : ESTADOS_FECHAMENTO.DONE, {
    finished_at: new Date().toISOString(),
    counters: {
      total_turmas: turmaIds.length,
      turmas_fechadas: turmaIds.length - fechamentoErrors.filter((e) => e.turma_id).length,
      total_matriculas: matriculaIds.length,
      matriculas_finalizadas: matriculaIds.length - finalizeErrors.length,
      historicos_gerados: matriculaIds.length - historyErrors.length,
    },
    errors: allErrors,
    matricula_ids: matriculaIds,
  });

  await supabase.from("audit_logs").insert({
    escola_id: escolaId,
    actor_id: executorUserId,
    action: "FECHAMENTO_ACADEMICO_FINISHED",
    entity: "fechamento_academico_jobs",
    entity_id: runId,
    portal: "secretaria",
    details: {
      acao,
      estado_final: failed ? ESTADOS_FECHAMENTO.FAILED : ESTADOS_FECHAMENTO.DONE,
      total_erros: allErrors.length,
    },
  });

  return { failed, errors: allErrors, matriculaIds };
}
