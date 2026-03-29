CREATE TABLE IF NOT EXISTS public.fiscal_reprocess_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.fiscal_empresas(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  total_links integer NOT NULL DEFAULT 0 CHECK (total_links >= 0),
  processed_links integer NOT NULL DEFAULT 0 CHECK (processed_links >= 0),
  success_links integer NOT NULL DEFAULT 0 CHECK (success_links >= 0),
  failed_links integer NOT NULL DEFAULT 0 CHECK (failed_links >= 0),
  requested_by uuid NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_reprocess_jobs_escola_empresa_created
  ON public.fiscal_reprocess_jobs (escola_id, empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_reprocess_jobs_status_created
  ON public.fiscal_reprocess_jobs (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_reprocess_jobs TO authenticated;
