BEGIN;

ALTER TABLE public.fechamento_academico_jobs
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'async' CHECK (execution_mode IN ('async','sync'));

CREATE INDEX IF NOT EXISTS idx_fechamento_academico_jobs_telemetry_window
  ON public.fechamento_academico_jobs (escola_id, created_at DESC, estado, fechamento_tipo);

CREATE INDEX IF NOT EXISTS idx_fechamento_academico_jobs_active_runs
  ON public.fechamento_academico_jobs (escola_id, estado, updated_at DESC)
  WHERE estado IN ('PENDING_VALIDATION', 'CLOSING_PERIOD', 'FINALIZING_ENROLLMENTS', 'GENERATING_HISTORY', 'OPENING_NEXT_PERIOD');

CREATE INDEX IF NOT EXISTS idx_fechamento_academico_steps_stage_status
  ON public.fechamento_academico_job_steps (escola_id, etapa, status, created_at DESC);

COMMIT;
