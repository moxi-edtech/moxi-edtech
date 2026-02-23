BEGIN;

CREATE TABLE IF NOT EXISTS public.pautas_lote_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  escola_id uuid NOT NULL,
  created_by uuid,
  tipo text NOT NULL,
  periodo_letivo_id uuid,
  status text DEFAULT 'PROCESSING'::text NOT NULL,
  total_turmas integer DEFAULT 0 NOT NULL,
  processed integer DEFAULT 0 NOT NULL,
  success_count integer DEFAULT 0 NOT NULL,
  failed_count integer DEFAULT 0 NOT NULL,
  zip_path text,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pautas_lote_jobs_pkey PRIMARY KEY (id)
);

ALTER TABLE public.pautas_lote_jobs
  ADD CONSTRAINT pautas_lote_jobs_escola_id_fkey
  FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;

ALTER TABLE public.pautas_lote_jobs
  ADD CONSTRAINT pautas_lote_jobs_periodo_letivo_id_fkey
  FOREIGN KEY (periodo_letivo_id) REFERENCES public.periodos_letivos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pautas_lote_jobs_escola
  ON public.pautas_lote_jobs (escola_id, status);

DROP TRIGGER IF EXISTS trg_pautas_lote_jobs_set_updated_at ON public.pautas_lote_jobs;
CREATE TRIGGER trg_pautas_lote_jobs_set_updated_at
  BEFORE UPDATE ON public.pautas_lote_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.pautas_lote_itens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  status text DEFAULT 'QUEUED'::text NOT NULL,
  pdf_path text,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pautas_lote_itens_pkey PRIMARY KEY (id)
);

ALTER TABLE public.pautas_lote_itens
  ADD CONSTRAINT pautas_lote_itens_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.pautas_lote_jobs(id) ON DELETE CASCADE;

ALTER TABLE public.pautas_lote_itens
  ADD CONSTRAINT pautas_lote_itens_turma_id_fkey
  FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pautas_lote_itens_job_turma
  ON public.pautas_lote_itens (job_id, turma_id);

DROP TRIGGER IF EXISTS trg_pautas_lote_itens_set_updated_at ON public.pautas_lote_itens;
CREATE TRIGGER trg_pautas_lote_itens_set_updated_at
  BEFORE UPDATE ON public.pautas_lote_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pautas_lote_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pautas_lote_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pautas_lote_jobs_select
  ON public.pautas_lote_jobs
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY pautas_lote_jobs_insert
  ON public.pautas_lote_jobs
  FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY pautas_lote_jobs_update
  ON public.pautas_lote_jobs
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY pautas_lote_itens_select
  ON public.pautas_lote_itens
  FOR SELECT TO authenticated
  USING (job_id IN (
    SELECT id FROM public.pautas_lote_jobs WHERE escola_id = public.current_tenant_escola_id()
  ));

CREATE POLICY pautas_lote_itens_insert
  ON public.pautas_lote_itens
  FOR INSERT TO authenticated
  WITH CHECK (job_id IN (
    SELECT id FROM public.pautas_lote_jobs WHERE escola_id = public.current_tenant_escola_id()
  ));

CREATE POLICY pautas_lote_itens_update
  ON public.pautas_lote_itens
  FOR UPDATE TO authenticated
  USING (job_id IN (
    SELECT id FROM public.pautas_lote_jobs WHERE escola_id = public.current_tenant_escola_id()
  ));

COMMIT;
