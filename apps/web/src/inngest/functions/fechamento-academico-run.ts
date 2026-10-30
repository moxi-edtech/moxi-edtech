import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { inngest } from "@/inngest/client";
import { runFechamentoOrchestration, ESTADOS_FECHAMENTO } from "@/lib/secretaria/fechamentoAcademicoOrchestrator";
import {
  FechamentoExecutionError,
  resolveVerifiedClosureExecution,
  type FechamentoJobSnapshot,
} from "@/lib/secretaria/fechamento-execution-contract";

const EXECUTOR_ROLES = ["admin", "admin_escola", "staff_admin", "admin_financeiro"];

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
  if (!accessToken) throw new FechamentoExecutionError("Token do executor ausente.");

  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: "Bearer " + accessToken } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Inngest event is a notification, never a source of academic parameters.
 * Verify the authenticated executor against the persisted school/run before
 * claiming the job and making any grade, frequency or enrolment changes.
 */
export const fechamentoAcademicoRun = inngest.createFunction(
  { id: "fechamento-academico-run", triggers: [{ event: "academico/fechamento.run.requested" }] },
  async ({ event }) => {
    const { run_id, escola_id, executor_user_id, executor_access_token } = event.data as {
      run_id: string;
      escola_id: string;
      executor_user_id: string;
      executor_access_token: string;
    };
    const supabaseAdmin = getSupabaseAdmin();
    let claimed = false;

    try {
      const supabase = getSupabaseForExecutor(executor_access_token);
      const { data: auth, error: authError } = await supabase.auth.getUser(executor_access_token);
      if (authError || !auth.user || auth.user.id !== executor_user_id) {
        throw new FechamentoExecutionError("A identidade do executor não foi confirmada.");
      }

      const { data: hasRole, error: roleError } = await supabase.rpc("user_has_role_in_school", {
        p_escola_id: escola_id,
        p_roles: EXECUTOR_ROLES,
      });
      if (roleError || !hasRole) {
        throw new FechamentoExecutionError("O executor não possui autorização nesta escola.");
      }

      const { data: job, error: jobError } = await supabaseAdmin
        .from("fechamento_academico_jobs")
        .select("run_id,escola_id,executor_user_id,fechamento_tipo,estado,ano_letivo_id,periodo_letivo_id,turma_ids,matricula_ids,parametros")
        .eq("escola_id", escola_id).eq("run_id", run_id).maybeSingle();
      if (jobError) throw jobError;
      if (!job) throw new FechamentoExecutionError("Job de fecho não encontrado nesta escola.");
      if (job.estado === ESTADOS_FECHAMENTO.DONE) return { ok: true, skipped: true };

      const execution = resolveVerifiedClosureExecution(
        job as FechamentoJobSnapshot,
        {
          runId: run_id, escolaId: escola_id,
          executorUserId: executor_user_id,
          authenticatedUserId: auth.user.id,
        },
      );

      // Atomic claim: a duplicated event cannot run the same irreversible
      // academic closing twice. A deliberate retry resets started_at to null.
      const { data: reservation, error: claimError } = await supabaseAdmin
        .from("fechamento_academico_jobs")
        .update({ started_at: new Date().toISOString() })
        .eq("escola_id", execution.escolaId).eq("run_id", execution.runId)
        .eq("estado", ESTADOS_FECHAMENTO.PENDING_VALIDATION)
        .is("started_at", null)
        .select("run_id").maybeSingle();
      if (claimError) throw claimError;
      if (!reservation?.run_id) return { ok: true, skipped: true, reason: "ALREADY_CLAIMED" };
      claimed = true;

      const result = await runFechamentoOrchestration({
        supabase,
        ...execution,
      });

      return { ok: true, failed: result.failed, errors: result.errors.length };
    } catch (error) {
      // Never write FAILED to an unverified event's run_id. Only the run
      // explicitly claimed for the same school may be marked as failed.
      if (claimed) {
        await supabaseAdmin.from("fechamento_academico_jobs")
          .update({
            estado: ESTADOS_FECHAMENTO.FAILED,
            finished_at: new Date().toISOString(),
            errors: [{
              stage: ESTADOS_FECHAMENTO.PENDING_VALIDATION,
              error: error instanceof Error ? error.message : String(error),
            }],
          })
          .eq("escola_id", escola_id).eq("run_id", run_id)
          .neq("estado", ESTADOS_FECHAMENTO.DONE);
      }
      throw error;
    }
  },
);
