import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { requireRoleInSchool } from "@/lib/authz";
import { executarValidacoesFechamento } from "./validacoes/engine";
import { inngest } from "@/inngest/client";
import { ESTADOS_FECHAMENTO, runFechamentoOrchestration, setJobState } from "@/lib/secretaria/fechamentoAcademicoOrchestrator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
});

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

export async function POST(req: Request) {
  try {
    const payload = StartSchema.safeParse(await req.json().catch(() => null));
    if (!payload.success) {
      return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
    }

    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      payload.data.escola_id ?? null,
      (user.user_metadata as { escola_id?: string | null } | null)?.escola_id ?? null
    );
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

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
        return NextResponse.json(
          {
            ok: false,
            error: "Pendências críticas impedem o fechamento.",
            bloqueado_por_pendencias: true,
            relatorio: relatorioSanidade,
          },
          { status: 422 }
        );
      }

      if (!payload.data.excecao_justificativa) {
        return NextResponse.json({ ok: false, error: "excecao_justificativa é obrigatória para exceção crítica." }, { status: 400 });
      }

      const { error: roleError } = await requireRoleInSchool({ supabase, escolaId, roles: ["admin", "admin_escola", "staff_admin"] });
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
      .select("run_id,estado,counters")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", payload.data.ano_letivo_id)
      .eq("fechamento_tipo", payload.data.acao)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing && existing.estado !== ESTADOS_FECHAMENTO.FAILED) {
      return NextResponse.json({ ok: true, idempotent: true, run_id: existing.run_id, estado: existing.estado, counters: existing.counters });
    }

    const runId = existing?.run_id ?? randomUUID();

    if (!existing) {
      const { error: insertError } = await supabase.from("fechamento_academico_jobs").insert({
        run_id: runId,
        escola_id: escolaId,
        executor_user_id: user.id,
        fechamento_tipo: payload.data.acao,
        estado: ESTADOS_FECHAMENTO.PENDING_VALIDATION,
        ano_letivo_id: payload.data.ano_letivo_id,
        periodo_letivo_id: payload.data.periodo_letivo_id ?? null,
        turma_ids: payload.data.turma_ids ?? [],
        matricula_ids: payload.data.matricula_ids ?? [],
        parametros: payload.data,
        idempotency_key: idempotencyKey,
        started_at: new Date().toISOString(),
        execution_mode: payload.data.executar_assincrono ? "async" : "sync",
      });
      if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    }

    const eventPayload = {
      run_id: runId,
      escola_id: escolaId,
      executor_user_id: user.id,
      acao: payload.data.acao,
      ano_letivo_id: payload.data.ano_letivo_id,
      periodo_letivo_id: payload.data.periodo_letivo_id ?? null,
      turma_ids: payload.data.turma_ids ?? [],
      matricula_ids: payload.data.matricula_ids ?? [],
      motivo: payload.data.motivo,
      allow_reaberto_override: payload.data.permitir_reaberto_override,
    };

    if (payload.data.executar_assincrono) {
      await dispatchAsyncRun(eventPayload);
      return NextResponse.json({ ok: true, run_id: runId, estado: ESTADOS_FECHAMENTO.PENDING_VALIDATION, queued: true }, { status: 202 });
    }

    const result = await runFechamentoOrchestration({
      supabase,
      runId,
      escolaId,
      executorUserId: user.id,
      acao: payload.data.acao,
      anoLetivoId: payload.data.ano_letivo_id,
      periodoLetivoId: payload.data.periodo_letivo_id,
      turmaIds: payload.data.turma_ids ?? [],
      matriculaIds: payload.data.matricula_ids ?? [],
      motivo: payload.data.motivo,
      allowReabertoOverride: payload.data.permitir_reaberto_override,
    });

    return NextResponse.json({ ok: true, run_id: runId, estado: result.failed ? ESTADOS_FECHAMENTO.FAILED : ESTADOS_FECHAMENTO.DONE, errors: result.errors });
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    let query = supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,fechamento_tipo,ano_letivo_id,execution_mode,counters,errors,started_at,finished_at,created_at,updated_at")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (runId) query = query.eq("run_id", runId);
    if (anoLetivoId) query = query.eq("ano_letivo_id", anoLetivoId);
    if (periodoLetivoId) query = query.eq("periodo_letivo_id", periodoLetivoId);
    if (fechamentoTipo === "fechar_trimestre" || fechamentoTipo === "fechar_ano") query = query.eq("fechamento_tipo", fechamentoTipo);

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
    if (!payload.success) return NextResponse.json({ ok: false, error: payload.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });

    const supabase = await supabaseServerTyped<Database>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

    const { data: job, error: jobError } = await supabase
      .from("fechamento_academico_jobs")
      .select("run_id,estado,fechamento_tipo,ano_letivo_id,periodo_letivo_id,turma_ids,matricula_ids,errors")
      .eq("escola_id", escolaId)
      .eq("run_id", payload.data.run_id)
      .single();

    if (jobError || !job) return NextResponse.json({ ok: false, error: "Execução não encontrada." }, { status: 404 });

    const failedMatriculasFromErrors = ((job.errors as any[]) ?? []).map((err) => err?.matricula_id).filter((id): id is string => Boolean(id));
    const retryMatriculas = payload.data.retry_failed_only
      ? Array.from(new Set(failedMatriculasFromErrors))
      : payload.data.matricula_ids ?? ((job.matricula_ids as string[]) ?? []);

    if (retryMatriculas.length > 0 && !payload.data.motivo_reabertura) {
      return NextResponse.json({ ok: false, error: "motivo_reabertura é obrigatório no reprocessamento." }, { status: 400 });
    }

    const retryTurmas = payload.data.turma_ids ?? ((job.turma_ids as string[]) ?? []);

    await setJobState(supabase, payload.data.run_id, ESTADOS_FECHAMENTO.PENDING_VALIDATION, {
      errors: [],
      started_at: new Date().toISOString(),
      finished_at: null,
      executor_user_id: user.id,
      execution_mode: payload.data.executar_assincrono ? "async" : "sync",
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
      if (reopenErr) return NextResponse.json({ ok: false, error: reopenErr.message }, { status: 400 });
    }

    const eventPayload = {
      run_id: payload.data.run_id,
      escola_id: escolaId,
      executor_user_id: user.id,
      acao: job.fechamento_tipo,
      ano_letivo_id: String(job.ano_letivo_id),
      periodo_letivo_id: (job.periodo_letivo_id as string | null) ?? null,
      turma_ids: retryTurmas,
      matricula_ids: retryMatriculas,
      motivo: payload.data.motivo_reabertura ?? "Reprocessamento parcial de fechamento acadêmico.",
      allow_reaberto_override: true,
    };

    if (payload.data.executar_assincrono) {
      await dispatchAsyncRun(eventPayload);
      return NextResponse.json({ ok: true, run_id: payload.data.run_id, estado: ESTADOS_FECHAMENTO.PENDING_VALIDATION, queued: true }, { status: 202 });
    }

    const result = await runFechamentoOrchestration({
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
      estado: result.failed ? ESTADOS_FECHAMENTO.FAILED : ESTADOS_FECHAMENTO.DONE,
      retried_matriculas: retryMatriculas.length,
      errors: result.errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
