import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { requireRoleInSchool } from "@/lib/authz";
import { executarValidacoesFechamento } from "./validacoes/engine";
import { inngest } from "@/inngest/client";

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
  executar_assincrono: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (data.acao === "fechar_trimestre" && !data.periodo_letivo_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["periodo_letivo_id"],
      message: "periodo_letivo_id é obrigatório quando acao=fechar_trimestre.",
    });
  }
});

const ACTIVE_STATES = [
  ESTADOS.PENDING_VALIDATION,
  ESTADOS.CLOSING_PERIOD,
  ESTADOS.FINALIZING_ENROLLMENTS,
  ESTADOS.GENERATING_HISTORY,
  ESTADOS.OPENING_NEXT_PERIOD,
] as const;

const RetrySchema = z.object({
  run_id: z.string().uuid(),
  retry_failed_only: z.boolean().default(true),
  turma_ids: z.array(z.string().uuid()).optional(),
  matricula_ids: z.array(z.string().uuid()).optional(),
  motivo_reabertura: z.string().max(1000).optional(),
  executar_assincrono: z.boolean().default(true),
});

async function dispatchAsyncRun(eventPayload: Record<string, unknown>) {
  await inngest.send({
    name: "academico/fechamento.run.requested",
    data: eventPayload,
  });
}

async function getExecutorAccessToken(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function insertStep(
  supabase: any,
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
  supabase: any,
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
  supabase: any;
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

  let finalMatriculaIds = [...params.matriculaIds];

  // 1. Fechar Período Acadêmico
  await setJobState(supabase, runId, ESTADOS.CLOSING_PERIOD);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.CLOSING_PERIOD,
    status: "STARTED",
    contexto: { turma_ids: turmaIds, periodo_letivo_id: periodoLetivoId ?? null },
  });

  const fechamentoErrors: any[] = [];
  if (acao === "fechar_trimestre") {
    if (!periodoLetivoId) throw new Error("periodo_letivo_id é obrigatório para fechar_trimestre.");
    for (const turmaId of turmaIds) {
      const { error } = await supabase.rpc("fechar_periodo_academico", {
        p_escola_id: escolaId,
        p_turma_id: turmaId,
        p_periodo_letivo_id: periodoLetivoId,
      });
      if (error) fechamentoErrors.push({ stage: ESTADOS.CLOSING_PERIOD, turma_id: turmaId, error: error.message });
    }
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.CLOSING_PERIOD,
    status: fechamentoErrors.length > 0 ? "FAILED" : "DONE",
    contexto: { failed_turmas: fechamentoErrors.length },
  });

  // 2. Finalizar Matrículas
  await setJobState(supabase, runId, ESTADOS.FINALIZING_ENROLLMENTS);
  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.FINALIZING_ENROLLMENTS,
    status: "STARTED",
  });

  if (finalMatriculaIds.length === 0) {
    const { data: anoRow } = await supabase.from("anos_letivos").select("ano").eq("id", anoLetivoId).single();
    let q = supabase.from("matriculas").select("id").eq("escola_id", escolaId).eq("ano_letivo", anoRow?.ano ?? -1);
    if (turmaIds.length > 0) q = q.in("turma_id", turmaIds);
    const { data: mats } = await q;
    finalMatriculaIds = (mats ?? []).map((m: any) => m.id);
  }

  try {
    await supabase.rpc("refresh_mv_boletim_por_matricula");
  } catch (err) {
    console.warn("[fechamento-academico] refresh_mv_boletim_por_matricula falhou", err);
  }

  const finalizeErrors: any[] = [];
  for (const mid of finalMatriculaIds) {
    const { error } = await supabase.rpc("finalizar_matricula_blindada", {
      p_escola_id: escolaId,
      p_matricula_id: mid,
      p_motivo: params.motivo ?? "Fechamento automático.",
    });
    if (error) finalizeErrors.push({ stage: ESTADOS.FINALIZING_ENROLLMENTS, matricula_id: mid, error: error.message });
  }

  await insertStep(supabase, {
    run_id: runId,
    escola_id: escolaId,
    executor_user_id: executorUserId,
    etapa: ESTADOS.FINALIZING_ENROLLMENTS,
    status: finalizeErrors.length > 0 ? "FAILED" : "DONE",
  });

  // 3. Gerar Histórico e Congelar
  await setJobState(supabase, runId, ESTADOS.GENERATING_HISTORY);
  const historyErrors: any[] = [];
  for (const mid of finalMatriculaIds) {
    const { error } = await supabase.rpc("gerar_historico_anual", { p_matricula_id: mid });
    if (error) historyErrors.push({ stage: ESTADOS.GENERATING_HISTORY, matricula_id: mid, error: error.message });
  }

  if (historyErrors.length === 0 && finalMatriculaIds.length > 0) {
    await supabase.rpc("historico_set_snapshot_state", {
      p_escola_id: escolaId,
      p_matricula_ids: finalMatriculaIds,
      p_ano_letivo_id: anoLetivoId,
      p_novo_estado: "fechado",
      p_run_id: runId,
    });
  }

  // 4. Abrir Próximo Período
  await setJobState(supabase, runId, ESTADOS.OPENING_NEXT_PERIOD);
  if (acao === "fechar_trimestre" && periodoLetivoId) {
    const { data: curr } = await supabase.from("periodos_letivos").select("numero,tipo").eq("id", periodoLetivoId).single();
    if (curr) {
      await supabase.from("periodos_letivos").update({ trava_notas_em: null })
        .eq("escola_id", escolaId).eq("ano_letivo_id", anoLetivoId).eq("tipo", curr.tipo).eq("numero", (curr.numero || 0) + 1);
    }
  }

  const allErrors = [...fechamentoErrors, ...finalizeErrors, ...historyErrors];
  const success = allErrors.length === 0;
  await setJobState(supabase, runId, success ? ESTADOS.DONE : ESTADOS.FAILED, {
    finished_at: new Date().toISOString(),
    errors: allErrors,
    matricula_ids: finalMatriculaIds
  });

  return { failed: !success, errors: allErrors };
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const payload = StartSchema.safeParse(json);
    if (!payload.success) return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message }, { status: 400 });

    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, payload.data.escola_id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const { error: roleError } = await requireRoleInSchool({ supabase, escolaId, roles: ["admin", "admin_escola", "staff_admin"] });
    if (roleError) return roleError;

    const { data: activeRun } = await supabase
      .from("fechamento_academico_jobs")
      .select("run_id, estado")
      .eq("escola_id", escolaId)
      .in("estado", [...ACTIVE_STATES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRun?.run_id) {
      return NextResponse.json(
        { ok: false, error: "Já existe um fechamento em execução", run_id: activeRun.run_id, estado: activeRun.estado },
        { status: 409 }
      );
    }

    const preflight = await executarValidacoesFechamento({
      supabase,
      escolaId,
      acao: payload.data.acao,
      anoLetivoId: payload.data.ano_letivo_id,
      periodoLetivoId: payload.data.periodo_letivo_id,
      turmaIds: payload.data.turma_ids,
      allowReabertoOverride: payload.data.permitir_reaberto_override,
    });

    const exceptionAudit = preflight.ok ? null : {
      acao: payload.data.acao,
      ano_letivo_id: payload.data.ano_letivo_id,
      periodo_letivo_id: payload.data.periodo_letivo_id ?? null,
      justificativa: payload.data.excecao_justificativa ?? null,
      idempotency_key: `${payload.data.ano_letivo_id}:${payload.data.periodo_letivo_id ?? "ano"}:${payload.data.acao}`,
      pendencias: preflight.pendencias.filter((p) => p.severidade === "CRITICAL").map((p) => p.id),
    };

    if (!preflight.ok) {
      if (!payload.data.permitir_excecao_critica) {
        return NextResponse.json({ ok: false, error: "Preflight bloqueado", relatorio: preflight }, { status: 422 });
      }

      if (!payload.data.excecao_justificativa) {
        return NextResponse.json({ ok: false, error: "Justificativa obrigatória para exceção" }, { status: 422 });
      }

      const allowedIds = new Set(payload.data.excecao_pendencia_ids ?? []);
      const criticalPendencias = preflight.pendencias.filter((p) => p.severidade === "CRITICAL");
      const invalidPendencias = criticalPendencias.filter((p) => !p.pode_excecao || !allowedIds.has(p.id));
      if (invalidPendencias.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Exceção insuficiente", pendencias: invalidPendencias, relatorio: preflight },
          { status: 422 }
        );
      }

    }

    const idempotencyKey = `${payload.data.ano_letivo_id}:${payload.data.periodo_letivo_id ?? "ano"}:${payload.data.acao}`;
    const { data: existing } = await supabase.from("fechamento_academico_jobs")
      .select("run_id,estado,counters").eq("idempotency_key", idempotencyKey).maybeSingle();

    if (existing && existing.estado !== ESTADOS.FAILED) {
      return NextResponse.json({ ok: true, idempotent: true, run_id: existing.run_id, estado: existing.estado });
    }

    const runId = existing?.run_id ?? randomUUID();
    if (!existing) {
      await supabase.from("fechamento_academico_jobs").insert({
        run_id: runId, escola_id: escolaId, executor_user_id: user.id, fechamento_tipo: payload.data.acao,
        estado: ESTADOS.PENDING_VALIDATION, ano_letivo_id: payload.data.ano_letivo_id,
        periodo_letivo_id: payload.data.periodo_letivo_id ?? null, idempotency_key: idempotencyKey,
        execution_mode: payload.data.executar_assincrono ? "async" : "sync",
      });
    }

    if (exceptionAudit) {
      await supabase.from("audit_logs").insert({
        escola_id: escolaId,
        actor_id: user.id,
        action: "FECHAMENTO_EXCECAO_APLICADA",
        entity: "fechamento_academico_jobs",
        entity_id: runId,
        portal: "secretaria",
        details: exceptionAudit,
      });
    }

    if (payload.data.executar_assincrono) {
      const token = await getExecutorAccessToken(supabase);
      await dispatchAsyncRun({ ...payload.data, run_id: runId, executor_access_token: token, executor_user_id: user.id, escola_id: escolaId });
      return NextResponse.json({ ok: true, run_id: runId, estado: ESTADOS.PENDING_VALIDATION, queued: true }, { status: 202 });
    }

    const result = await runOrchestration({
      supabase, runId, escolaId, executorUserId: user.id, acao: payload.data.acao,
      anoLetivoId: payload.data.ano_letivo_id, periodoLetivoId: payload.data.periodo_letivo_id,
      turmaIds: payload.data.turma_ids ?? [], matriculaIds: payload.data.matricula_ids ?? [],
      allowReabertoOverride: payload.data.permitir_reaberto_override,
    });

    return NextResponse.json({ ok: true, run_id: runId, estado: result.failed ? ESTADOS.FAILED : ESTADOS.DONE, errors: result.errors });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id");
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    let q = supabase.from("fechamento_academico_jobs").select("*").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20);
    if (runId) q = q.eq("run_id", runId);
    const { data: jobs } = await q;

    const runIds = (jobs ?? []).map(j => j.run_id);
    const { data: steps } = await supabase.from("fechamento_academico_job_steps").select("*").in("run_id", runIds).order("created_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      jobs: jobs?.map(j => ({ ...j, steps: steps?.filter(s => s.run_id === j.run_id) ?? [] }))
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const payload = RetrySchema.safeParse(json);
    if (!payload.success) return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });

    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    const { data: job } = await supabase.from("fechamento_academico_jobs").select("*").eq("run_id", payload.data.run_id).single();
    if (!job) return NextResponse.json({ ok: false, error: "Não encontrado" }, { status: 404 });

    await setJobState(supabase, job.run_id, ESTADOS.PENDING_VALIDATION, { started_at: new Date().toISOString(), finished_at: null });

    if (payload.data.executar_assincrono) {
      const token = await getExecutorAccessToken(supabase);
      await dispatchAsyncRun({ ...job, run_id: job.run_id, executor_access_token: token, executor_user_id: user.id, escola_id: escolaId });
      return NextResponse.json({ ok: true, run_id: job.run_id, estado: ESTADOS.PENDING_VALIDATION, queued: true }, { status: 202 });
    }

    const acao = job.fechamento_tipo === "fechar_trimestre" || job.fechamento_tipo === "fechar_ano"
      ? job.fechamento_tipo
      : null;
    if (!acao) return NextResponse.json({ ok: false, error: "Tipo de fechamento inválido" }, { status: 400 });
    if (!job.ano_letivo_id) return NextResponse.json({ ok: false, error: "Ano letivo obrigatório" }, { status: 400 });

    const result = await runOrchestration({
      supabase,
      runId: job.run_id,
      escolaId: String(escolaId),
      executorUserId: user.id,
      acao,
      anoLetivoId: job.ano_letivo_id,
      periodoLetivoId: job.periodo_letivo_id ?? undefined,
      turmaIds: job.turma_ids ?? [],
      matriculaIds: job.matricula_ids ?? [],
    });

    return NextResponse.json({ ok: true, run_id: job.run_id, estado: result.failed ? ESTADOS.FAILED : ESTADOS.DONE });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
