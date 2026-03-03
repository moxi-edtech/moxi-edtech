BEGIN;

CREATE TABLE IF NOT EXISTS public.fechamento_academico_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  executor_user_id uuid,
  fechamento_tipo text NOT NULL CHECK (fechamento_tipo IN ('fechar_trimestre', 'fechar_ano')),
  estado text NOT NULL DEFAULT 'PENDING_VALIDATION' CHECK (
    estado IN (
      'PENDING_VALIDATION',
      'CLOSING_PERIOD',
      'FINALIZING_ENROLLMENTS',
      'GENERATING_HISTORY',
      'OPENING_NEXT_PERIOD',
      'DONE',
      'FAILED'
    )
  ),
  ano_letivo_id uuid NOT NULL REFERENCES public.anos_letivos(id) ON DELETE CASCADE,
  periodo_letivo_id uuid REFERENCES public.periodos_letivos(id) ON DELETE SET NULL,
  turma_ids uuid[] NOT NULL DEFAULT '{}',
  matricula_ids uuid[] NOT NULL DEFAULT '{}',
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fechamento_academico_jobs_idempotency
  ON public.fechamento_academico_jobs (escola_id, ano_letivo_id, COALESCE(periodo_letivo_id, '00000000-0000-0000-0000-000000000000'::uuid), fechamento_tipo);

CREATE INDEX IF NOT EXISTS idx_fechamento_academico_jobs_status
  ON public.fechamento_academico_jobs (escola_id, estado, created_at DESC);

DROP TRIGGER IF EXISTS trg_fechamento_academico_jobs_updated_at ON public.fechamento_academico_jobs;
CREATE TRIGGER trg_fechamento_academico_jobs_updated_at
  BEFORE UPDATE ON public.fechamento_academico_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.fechamento_academico_job_steps (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.fechamento_academico_jobs(run_id) ON DELETE CASCADE,
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  executor_user_id uuid,
  etapa text NOT NULL,
  status text NOT NULL CHECK (status IN ('STARTED', 'DONE', 'FAILED')),
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_academico_steps_run
  ON public.fechamento_academico_job_steps (run_id, created_at DESC);

ALTER TABLE public.fechamento_academico_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_academico_job_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY fechamento_academico_jobs_select
  ON public.fechamento_academico_jobs FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY fechamento_academico_jobs_insert
  ON public.fechamento_academico_jobs FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY fechamento_academico_jobs_update
  ON public.fechamento_academico_jobs FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY fechamento_academico_steps_select
  ON public.fechamento_academico_job_steps FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY fechamento_academico_steps_insert
  ON public.fechamento_academico_job_steps FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
SELECT null, null, 'MIGRATION_APPLIED', 'fechamento_academico_jobs', 'system',
       jsonb_build_object('migration', '20261202090000_create_fechamento_academico_jobs.sql')
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fechamento_academico_jobs');

COMMIT;
