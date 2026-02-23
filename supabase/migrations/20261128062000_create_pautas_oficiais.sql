BEGIN;

CREATE TABLE IF NOT EXISTS public.pautas_oficiais (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  periodo_letivo_id uuid NOT NULL,
  pdf_path text NOT NULL,
  hash text NOT NULL,
  tipo text DEFAULT 'trimestral'::text NOT NULL,
  generated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT pautas_oficiais_pkey PRIMARY KEY (id)
);

ALTER TABLE public.pautas_oficiais
  ADD CONSTRAINT pautas_oficiais_escola_id_fkey
  FOREIGN KEY (escola_id) REFERENCES public.escolas(id) ON DELETE CASCADE;

ALTER TABLE public.pautas_oficiais
  ADD CONSTRAINT pautas_oficiais_turma_id_fkey
  FOREIGN KEY (turma_id) REFERENCES public.turmas(id) ON DELETE CASCADE;

ALTER TABLE public.pautas_oficiais
  ADD CONSTRAINT pautas_oficiais_periodo_letivo_id_fkey
  FOREIGN KEY (periodo_letivo_id) REFERENCES public.periodos_letivos(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pautas_oficiais_lookup
  ON public.pautas_oficiais (escola_id, turma_id, periodo_letivo_id, tipo);

CREATE INDEX IF NOT EXISTS idx_pautas_oficiais_turma
  ON public.pautas_oficiais (turma_id);

DROP TRIGGER IF EXISTS trg_pautas_oficiais_set_updated_at ON public.pautas_oficiais;
CREATE TRIGGER trg_pautas_oficiais_set_updated_at
  BEFORE UPDATE ON public.pautas_oficiais
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pautas_oficiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY pautas_oficiais_select
  ON public.pautas_oficiais
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

CREATE POLICY pautas_oficiais_insert
  ON public.pautas_oficiais
  FOR INSERT TO authenticated
  WITH CHECK (escola_id = public.current_tenant_escola_id());

CREATE POLICY pautas_oficiais_update
  ON public.pautas_oficiais
  FOR UPDATE TO authenticated
  USING (escola_id = public.current_tenant_escola_id());

COMMIT;
