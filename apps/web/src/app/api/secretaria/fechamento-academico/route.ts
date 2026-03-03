import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { requireRoleInSchool } from "@/lib/authz";
import { executarValidacoesFechamento } from "./validacoes/engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ESTADOS = {
  PENDING_VALIDATION: "PENDING_VALIDATION",
  CLOSING_PERIOD: "CLOSING_PERIOD",
  FINALIZING_ENROLLMENTS: "FINALIZING_ENROLLMENTS",
  GENERATING_HISTORY: "GENERATING_HISTORY",
  OPENING_NEXT_PERIOD: "OPENING_NEXT_PERIOD",
  DONE: "DONE",
  FAILED: "FAILED",
} as const;

type EstadoFechamento = (typeof ESTADOS)[keyof typeof ESTADOS];

const StartSchema = z.object({
  acao: z.enum(["fechar_trimestre", "fechar_ano"]),
  escola_id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid(),
  periodo_letivo_id: z.string().uuid().optional(),
  turma_ids: z.array(z.string().uuid()).optional(),
  matricula_ids: z.array(z.string().uuid()).optional(),
  motivo: z.string().max(500).optional(),
  permitir_excecao_critica: z.boolean().default(false),
  excecao_justificativa: z.string().max(1000).optional(),
  excecao_pendencia_ids: z.array(z.string()).optional(),
  permitir_reaberto_override: z.boolean().default(false),
});

const RetrySchema = z.object({
  run_id: z.string().uuid(),
  retry_failed_only: z.boolean().default(true),
  turma_ids: z.array(z.string().uuid()).optional(),
  matricula_ids: z.array(z.string().uuid()).optional(),
  motivo_reabertura: z.string().max(1000).optional(),
});

async function insertStep(
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>,
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

async function setJobState(
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>,
  runId: string,
  estado: EstadoFechamento,
  patch?: Record<string, unknown>
) {
  await supabase
    .from("fechamento_academico_jobs")
    .update({ estado, updated_at: new Date().toISOString(), ...(patch ?? {}) })
    .eq("run_id", runId);
}

async function runOrchestration(params: {
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<Database>>>;
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
    await setJobState(supabase, runId, ESTADOS.FAILED, {
      finished_at: new Date().toISOString(),
      errors: legalSnapshotBlockers.map((p) => ({ stage: ESTADOS.PENDING_VALIDATION, matricula_id: p.matricula_id, error: p.mensagem })),
      relatorio_preflight: preflight,
    });

    throw new Error("Snapshot legal já congelado para uma ou mais matrículas. Reabertura auditada é obrigatória.");
  }
  let matriculaIds = [...params.matriculaIds];

  await setJobState(supabase, runId, ESTADOS.CLOSING_PERIOD);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.CLOSING_PERIOD,
    status: "STARTED",
    contexto: { turma_ids: turmaIds, periodo_letivo_id: periodoLetivoId ?? null },
  });

  const fechamentoErrors: Array<{ stage: string; turma_id?: string; matricula_id?: string; error: string }> = [];

  if (acao === "fechar_trimestre") {
    if (!periodoLetivoId) {
      throw new Error("periodo_letivo_id é obrigatório para fechar_trimestre.");
    }
    for (const turmaId of turmaIds) {
      const { error } = await supabase.rpc("fechar_periodo_academico", {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_periodo_letivo_id: periodoLetivoId,
      });
      if (error) {
        fechamentoErrors.push({ stage: ESTADOS.CLOSING_PERIOD, turma_id: turmaId, error: error.message });
      }
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.CLOSING_PERIOD,
    status: fechamentoErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_turmas: fechamentoErrors.filter((x) => x.turma_id).length },
    error_message: fechamentoErrors.length > 0 ? "Falha ao fechar uma ou mais turmas." : null,
  });

  await setJobState(supabase, runId, ESTADOS.FINALIZING_ENROLLMENTS);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.FINALIZING_ENROLLMENTS,
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
    matriculaIds = (matriculas ?? []).map((m) => m.id as string);
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
    if (error) {
      finalizeErrors.push({ stage: ESTADOS.FINALIZING_ENROLLMENTS, matricula_id: matriculaId, error: error.message });
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.FINALIZING_ENROLLMENTS,
    status: finalizeErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_matriculas: finalizeErrors.length, total_matriculas: matriculaIds.length },
    error_message: finalizeErrors.length > 0 ? "Falha ao finalizar uma ou mais matrículas." : null,
  });

  await setJobState(supabase, runId, ESTADOS.GENERATING_HISTORY);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.GENERATING_HISTORY,
    status: "STARTED",
  });

  const historyErrors: Array<{ stage: string; turma_id?: string; matricula_id?: string; error: string }> = [];
  for (const matriculaId of matriculaIds) {
    const { error } = await supabase.rpc("gerar_historico_anual", {
      p_matricula_id: matriculaId,
    });
    if (error) {
      historyErrors.push({ stage: ESTADOS.GENERATING_HISTORY, matricula_id: matriculaId, error: error.message });
    }
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
      historyErrors.push({ stage: ESTADOS.GENERATING_HISTORY, error: `Falha ao congelar snapshot legal: ${snapshotLockError.message}` });
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.GENERATING_HISTORY,
    status: historyErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_matriculas: historyErrors.length },
    error_message: historyErrors.length > 0 ? "Falha ao gerar histórico anual de uma ou mais matrículas." : null,
  });

  await setJobState(supabase, runId, ESTADOS.OPENING_NEXT_PERIOD);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.OPENING_NEXT_PERIOD,
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
    const { data: currentYear } = await supabase
      .from("anos_letivos")
      .select("ano")
      .eq("escola_id", escolaId)
      .eq("id", anoLetivoId)
      .single();

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
    etapa: ESTADOS.OPENING_NEXT_PERIOD,
    status: "DONE",
  });

  const allErrors = [...fechamentoErrors, ...finalizeErrors, ...historyErrors];
  const failed = allErrors.length > 0;
  await setJobState(supabase, runId, failed ? ESTADOS.FAILED : ESTADOS.DONE, {
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
      estado_final: failed ? ESTADOS.FAILED : ESTADOS.DONE,
      total_erros: allErrors.length,
    },
  });

  return { failed, errors: allErrors, matriculaIds };
}

export async function POST(req: Request) {
  try {
    const payload = StartSchema.safeParse(await req.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      payload.data.escola_id ?? null,
      (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
    );

    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });
    }

    const relatorioSanidade = await executarValidacoesFechamento({
      supabase,
      escolaId,
      acao: payload.data.acao,
      anoLetivoId: payload.data.ano_letivo_id,
      periodoLetivoId: payload.data.periodo_letivo_id,
      turmaIds: payload.data.turma_ids ?? [],
      allowReabertoOverride: payload.data.permitir_reaberto_override,
    });

    const criticalPendencias = relatorioSanidade.pendencias.filter((p) => p.severidade === "CRITICAL");
    if (criticalPendencias.length > 0) {
      const allowException = payload.data.permitir_excecao_critica;
      if (!allowException) {
        return NextResponse.json({
          ok: false,
          error: "Pendências críticas impedem o fechamento.",
          bloqueado_por_pendencias: true,
          relatorio: relatorioSanidade,
        }, { status: 422 });
      }

      if (!payload.data.excecao_justificativa) {
        return NextResponse.json({ ok: false, error: "excecao_justificativa é obrigatória para exceção crítica." }, { status: 400 });
      }

      const { error: roleError } = await requireRoleInSchool({
        supabase,
        escolaId,
        roles: ["admin", "admin_escola", "staff_admin"],
      });
      if (roleError) return roleError;

      await supabase.from("audit_logs").insert({
        escola_id: escolaId,
        actor_id: user.id,
        action: "FECHAMENTO_ACADEMICO_EXCEPTION_APPROVED",
        entity: "fechamento_academico_jobs",
        portal: "secretaria",
        details: {
          acao: payload.data.acao,
          ano_letivo_id: payload.data.ano_letivo_id,
          periodo_letivo_id: payload.data.periodo_letivo_id ?? null,
          justificativa: payload.data.excecao_justificativa,
          pendencia_ids: payload.data.excecao_pendencia_ids ?? criticalPendencias.map((p) => p.id),
          pendencias_criticas_total: criticalPendencias.length,
        },
      });
    }

    const idempotencyKey = `${payload.data.ano_letivo_id}:${payload.data.periodo_letivo_id ?? "none"}:${payload.data.acao}`;

    const { data: existing } = await supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,errors,counters")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", payload.data.ano_letivo_id)
      .eq("fechamento_tipo", payload.data.acao)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing && existing.estado !== ESTADOS.FAILED) {
      return NextResponse.json({ ok: true, idempotent: true, run_id: existing.run_id, estado: existing.estado, counters: existing.counters });
    }

    const runId = existing?.run_id ?? randomUUID();

    if (!existing) {
      const { error: insertError } = await supabase.from("fechamento_academico_jobs").insert({
        run_id: runId,
        escola_id: escolaId,
        executor_user_id: user.id,
        fechamento_tipo: payload.data.acao,
        estado: ESTADOS.PENDING_VALIDATION,
        ano_letivo_id: payload.data.ano_letivo_id,
        periodo_letivo_id: payload.data.periodo_letivo_id ?? null,
        turma_ids: payload.data.turma_ids ?? [],
        matricula_ids: payload.data.matricula_ids ?? [],
        parametros: payload.data,
        idempotency_key: idempotencyKey,
        started_at: new Date().toISOString(),
      });

      if (insertError) {
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
      }
    }

    const turmaIds = payload.data.turma_ids ?? [];
    const result = await runOrchestration({
      supabase,
      runId,
      escolaId,
      executorUserId: user.id,
      acao: payload.data.acao,
      anoLetivoId: payload.data.ano_letivo_id,
      periodoLetivoId: payload.data.periodo_letivo_id,
      turmaIds,
      matriculaIds: payload.data.matricula_ids ?? [],
      motivo: payload.data.motivo,
      allowReabertoOverride: payload.data.permitir_reaberto_override,
    });

    return NextResponse.json({
      ok: true,
      run_id: runId,
      estado: result.failed ? ESTADOS.FAILED : ESTADOS.DONE,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id");
    const anoLetivoId = url.searchParams.get("ano_letivo_id");
    const periodoLetivoId = url.searchParams.get("periodo_letivo_id");
    const fechamentoTipo = url.searchParams.get("acao");

    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    let query = supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,fechamento_tipo,ano_letivo_id,counters,errors,started_at,finished_at,created_at,updated_at")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (runId) query = query.eq("run_id", runId);
    if (anoLetivoId) query = query.eq("ano_letivo_id", anoLetivoId);
    if (periodoLetivoId) query = query.eq("periodo_letivo_id", periodoLetivoId);
    if (fechamentoTipo === "fechar_trimestre" || fechamentoTipo === "fechar_ano") {
      query = query.eq("fechamento_tipo", fechamentoTipo);
    }

    const { data: jobs, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const runIds = (jobs ?? []).map((job) => job.run_id as string);
    const { data: steps } = runIds.length
      ? await supabase
          .from("fechamento_academico_job_steps")
          .select("run_id,etapa,status,contexto,error_message,created_at")
          .eq("escola_id", escolaId)
          .in("run_id", runIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null as null };

    const stepsByRun = (steps ?? []).reduce<Record<string, any[]>>((acc, step) => {
      const key = String(step.run_id);
      acc[key] = acc[key] ?? [];
      acc[key].push(step);
      return acc;
    }, {});

    const anoLetivoIds = Array.from(new Set((jobs ?? []).map((j) => String(j.ano_letivo_id)).filter(Boolean)));
    const { data: snapshotRows } = anoLetivoIds.length
      ? await supabase
          .from("vw_historico_snapshot_status")
          .select("ano_letivo_id,status")
          .eq("escola_id", escolaId)
          .in("ano_letivo_id", anoLetivoIds)
      : { data: [] as any[] };

    const snapshotSummary = (snapshotRows ?? []).reduce<Record<string, { aberto: number; fechado: number; reaberto: number }>>((acc, row: any) => {
      const key = String(row.ano_letivo_id);
      const st = String(row.status || "aberto") as "aberto" | "fechado" | "reaberto";
      acc[key] = acc[key] ?? { aberto: 0, fechado: 0, reaberto: 0 };
      acc[key][st] += 1;
      return acc;
    }, {});

    return NextResponse.json({
      ok: true,
      jobs:
        jobs?.map((job) => ({
          ...job,
          steps: stepsByRun[String(job.run_id)] ?? [],
          snapshot_summary: snapshotSummary[String(job.ano_letivo_id)] ?? { aberto: 0, fechado: 0, reaberto: 0 },
        })) ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const payload = RetrySchema.safeParse(await req.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const { data: job, error: jobError } = await supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,fechamento_tipo,ano_letivo_id,periodo_letivo_id,turma_ids,matricula_ids,errors")
      .eq("escola_id", escolaId)
      .eq("run_id", payload.data.run_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: "Execução não encontrada." }, { status: 404 });
    }

    const failedMatriculasFromErrors = ((job.errors as any[]) ?? [])
      .map((err) => err?.matricula_id)
      .filter((id): id is string => Boolean(id));

    const retryMatriculas = payload.data.retry_failed_only
      ? Array.from(new Set(failedMatriculasFromErrors))
      : payload.data.matricula_ids ?? ((job.matricula_ids as string[]) ?? []);

    if (retryMatriculas.length > 0 && !payload.data.motivo_reabertura) {
      return NextResponse.json({ ok: false, error: "motivo_reabertura é obrigatório no reprocessamento." }, { status: 400 });
    }

    const retryTurmas = payload.data.turma_ids ?? ((job.turma_ids as string[]) ?? []);

    await setJobState(supabase, payload.data.run_id, ESTADOS.PENDING_VALIDATION, {
      errors: [],
      started_at: new Date().toISOString(),
      finished_at: null,
      executor_user_id: user.id,
    });

    if (retryMatriculas.length > 0) {
      const { error: reopenErr } = await supabase.rpc("historico_set_snapshot_state", {
        p_escola_id: escolaId,
        p_matricula_ids: retryMatriculas,
        p_ano_letivo_id: String(job.ano_letivo_id),
        p_novo_estado: "reaberto",
        p_motivo: payload.data.motivo_reabertura,
        p_run_id: payload.data.run_id,
      });
      if (reopenErr) {
        return NextResponse.json({ ok: false, error: reopenErr.message }, { status: 400 });
      }
    }

    const result = await runOrchestration({
      supabase,
      runId: payload.data.run_id,
      escolaId,
      executorUserId: user.id,
      acao: job.fechamento_tipo as "fechar_trimestre" | "fechar_ano",
      anoLetivoId: String(job.ano_letivo_id),
      periodoLetivoId: (job.periodo_letivo_id as string | null) ?? undefined,
      turmaIds: retryTurmas,
      matriculaIds: retryMatriculas,
      motivo: payload.data.motivo_reabertura ?? "Reprocessamento parcial de fechamento acadêmico.",
      allowReabertoOverride: true,
    });

    return NextResponse.json({
      ok: true,
      run_id: payload.data.run_id,
      estado: result.failed ? ESTADOS.FAILED : ESTADOS.DONE,
      retried_matriculas: retryMatriculas.length,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
