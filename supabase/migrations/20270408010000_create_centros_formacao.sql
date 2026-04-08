BEGIN;

CREATE TABLE IF NOT EXISTS public.centros_formacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL UNIQUE REFERENCES public.escolas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  nome text NOT NULL,
  abrev text,
  logo_url text,

  nipc text,
  nif text,
  registo_maptess text,

  morada text,
  municipio text,
  provincia text NOT NULL DEFAULT 'Luanda',
  telefone text,
  email text,
  website text,

  areas_formacao jsonb NOT NULL DEFAULT '[]'::jsonb,
  capacidade_max integer,
  modalidades jsonb NOT NULL DEFAULT '[]'::jsonb,

  status text NOT NULL DEFAULT 'onboarding' CHECK (status IN ('onboarding', 'ativo', 'suspenso', 'cancelado')),
  plano text NOT NULL DEFAULT 'basic' CHECK (plano IN ('basic', 'pro', 'enterprise')),

  moeda text NOT NULL DEFAULT 'AOA',
  regime_iva text NOT NULL DEFAULT 'normal' CHECK (regime_iva IN ('normal', 'simplificado', 'isento')),

  notas_admin text,
  provisionado_por uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_centros_formacao_status ON public.centros_formacao(status);
CREATE INDEX IF NOT EXISTS idx_centros_formacao_plano ON public.centros_formacao(plano);
CREATE INDEX IF NOT EXISTS idx_centros_formacao_municipio ON public.centros_formacao(municipio);

ALTER TABLE public.centros_formacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS centros_formacao_super_admin_select ON public.centros_formacao;
CREATE POLICY centros_formacao_super_admin_select
  ON public.centros_formacao
  FOR SELECT
  USING (
    check_super_admin_role()
    OR public.user_has_role_in_school(
      escola_id,
      ARRAY['formacao_admin', 'formacao_secretaria', 'formacao_financeiro', 'formador', 'formando']
    )
  );

DROP POLICY IF EXISTS centros_formacao_super_admin_mutation ON public.centros_formacao;
CREATE POLICY centros_formacao_super_admin_mutation
  ON public.centros_formacao
  FOR ALL
  USING (check_super_admin_role())
  WITH CHECK (check_super_admin_role());

COMMIT;
