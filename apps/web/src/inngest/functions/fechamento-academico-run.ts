import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { inngest } from "@/inngest/client";
import { runFechamentoOrchestration, setJobState, ESTADOS_FECHAMENTO } from "@/lib/secretaria/fechamentoAcademicoOrchestrator";

const getSupabaseAdmin = () => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient<Database>(url, key);
};

const getSupabaseForExecutor = (accessToken: string) => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !anonKey) throw new Error("Credenciais públicas do Supabase ausentes");
  if (!accessToken) throw new Error("Token do executor ausente para fechamento assíncrono");

  return createClient<Database>(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const fechamentoAcademicoRun = inngest.createFunction(
  { id: "fechamento-academico-run", triggers: [{ event: "academico/fechamento.run.requested" }] },
  async ({ event }) => {
    const supabaseAdmin = getSupabaseAdmin();
    const { run_id, escola_id, executor_user_id, executor_access_token, acao, ano_letivo_id, periodo_letivo_id, turma_ids, matricula_ids, motivo, allow_reaberto_override } = event.data as any;
    const supabase = getSupabaseForExecutor(executor_access_token);

    try {
      const { data: job } = await supabaseAdmin
        .from("fechamento_academico_jobs")
        .select("run_id,estado")
        .eq("escola_id", escola_id)
        .eq("run_id", run_id)
        .maybeSingle();

      if (!job?.run_id) throw new Error("Execução de fechamento não encontrada");
      if (job.estado === ESTADOS_FECHAMENTO.DONE) return { ok: true, skipped: true };

      const result = await runFechamentoOrchestration({
        supabase,
        runId: run_id,
        escolaId: escola_id,
        executorUserId: executor_user_id,
        acao,
        anoLetivoId: ano_letivo_id,
        periodoLetivoId: periodo_letivo_id ?? undefined,
        turmaIds: turma_ids ?? [],
        matriculaIds: matricula_ids ?? [],
        motivo,
        allowReabertoOverride: Boolean(allow_reaberto_override),
      });

      return { ok: true, failed: result.failed, errors: result.errors.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setJobState(supabaseAdmin, run_id, ESTADOS_FECHAMENTO.FAILED, {
        finished_at: new Date().toISOString(),
        errors: [{ stage: ESTADOS_FECHAMENTO.PENDING_VALIDATION, error: message }],
      });
      throw error;
    }
  }
);
