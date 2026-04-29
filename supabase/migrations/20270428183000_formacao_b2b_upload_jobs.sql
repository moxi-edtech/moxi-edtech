CREATE TABLE IF NOT EXISTS public.formacao_b2b_upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_by uuid NULL,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE RESTRICT,
  cliente_b2b_id uuid NULL REFERENCES public.formacao_clientes_b2b(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'partial', 'success', 'failed')),
  total_rows integer NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  processed_rows integer NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
  success_count integer NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  report jsonb NULL,
  last_error text NULL,
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_formacao_b2b_upload_jobs_escola_created_at
  ON public.formacao_b2b_upload_jobs (escola_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_formacao_b2b_upload_jobs_status
  ON public.formacao_b2b_upload_jobs (status, created_at DESC);
