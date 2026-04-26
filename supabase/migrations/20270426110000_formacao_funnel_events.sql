CREATE TABLE IF NOT EXISTS public.formacao_funnel_eventos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  app text NOT NULL DEFAULT 'formacao',
  event text NOT NULL,
  stage text NOT NULL,
  path text NULL,
  source text NULL,
  tenant_slug text NULL,
  tenant_id uuid NULL,
  user_id uuid NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'formacao_funnel_eventos_stage_check'
  ) THEN
    ALTER TABLE public.formacao_funnel_eventos
      ADD CONSTRAINT formacao_funnel_eventos_stage_check
      CHECK (stage IN ('dashboard', 'mentorias', 'nova_mentoria', 'vendas', 'checkout', 'inscricao'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_formacao_funnel_eventos_created_at
  ON public.formacao_funnel_eventos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_formacao_funnel_eventos_tenant_created_at
  ON public.formacao_funnel_eventos (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_formacao_funnel_eventos_event_created_at
  ON public.formacao_funnel_eventos (event, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_formacao_funnel_eventos_stage_created_at
  ON public.formacao_funnel_eventos (stage, created_at DESC);

ALTER TABLE public.formacao_funnel_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_funnel_eventos_insert_anon ON public.formacao_funnel_eventos;
CREATE POLICY formacao_funnel_eventos_insert_anon
ON public.formacao_funnel_eventos
FOR INSERT
TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS formacao_funnel_eventos_insert_authenticated ON public.formacao_funnel_eventos;
CREATE POLICY formacao_funnel_eventos_insert_authenticated
ON public.formacao_funnel_eventos
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS formacao_funnel_eventos_select_authenticated ON public.formacao_funnel_eventos;
CREATE POLICY formacao_funnel_eventos_select_authenticated
ON public.formacao_funnel_eventos
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT, INSERT ON public.formacao_funnel_eventos TO anon, authenticated;
