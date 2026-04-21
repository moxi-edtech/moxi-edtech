BEGIN;

CREATE TABLE IF NOT EXISTS public.formacao_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL REFERENCES public.formacao_cohorts(id) ON DELETE CASCADE,
  formando_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origem text NOT NULL DEFAULT 'balcao' CHECK (origem IN ('balcao', 'b2b_upload', 'self_service')),
  estado text NOT NULL DEFAULT 'inscrito' CHECK (estado IN ('pre_inscrito', 'inscrito', 'cancelado', 'concluido')),
  status_pagamento text NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente', 'parcial', 'pago', 'cancelado')),
  modalidade text NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online_live', 'online_gravado')),
  valor_cobrado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_cobrado >= 0),
  nome_snapshot text,
  email_snapshot text,
  bi_snapshot text,
  telefone_snapshot text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT formacao_inscricoes_unique UNIQUE (escola_id, cohort_id, formando_user_id)
);

CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_escola_cohort
  ON public.formacao_inscricoes(escola_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_formando
  ON public.formacao_inscricoes(escola_id, formando_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_estado
  ON public.formacao_inscricoes(escola_id, estado, status_pagamento);
CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_origem
  ON public.formacao_inscricoes(escola_id, origem, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_formacao_inscricoes_bi_norm
  ON public.formacao_inscricoes(
    escola_id,
    regexp_replace(upper(coalesce(bi_snapshot, '')), '[^A-Z0-9]', '', 'g')
  )
  WHERE nullif(btrim(coalesce(bi_snapshot, '')), '') IS NOT NULL;

ALTER TABLE public.formacao_inscricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS formacao_inscricoes_select_policy ON public.formacao_inscricoes;
CREATE POLICY formacao_inscricoes_select_policy
  ON public.formacao_inscricoes
  FOR SELECT
  USING (
    escola_id = public.current_tenant_escola_id()
    AND (
      public.can_access_formacao_backoffice(escola_id)
      OR formando_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS formacao_inscricoes_mutation_policy ON public.formacao_inscricoes;
CREATE POLICY formacao_inscricoes_mutation_policy
  ON public.formacao_inscricoes
  FOR ALL
  USING (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  )
  WITH CHECK (
    escola_id = public.current_tenant_escola_id()
    AND public.can_access_formacao_backoffice(escola_id)
  );

CREATE OR REPLACE FUNCTION public.formacao_create_inscricao(
  p_escola_id uuid,
  p_cohort_id uuid,
  p_formando_user_id uuid,
  p_origem text DEFAULT 'balcao',
  p_modalidade text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_nome_snapshot text DEFAULT NULL,
  p_email_snapshot text DEFAULT NULL,
  p_bi_snapshot text DEFAULT NULL,
  p_telefone_snapshot text DEFAULT NULL,
  p_valor_cobrado numeric DEFAULT 0
)
RETURNS public.formacao_inscricoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort public.formacao_cohorts%ROWTYPE;
  v_existing public.formacao_inscricoes%ROWTYPE;
  v_modalidade text;
  v_ocupacao integer;
  v_profile record;
BEGIN
  IF p_escola_id IS NULL OR p_cohort_id IS NULL OR p_formando_user_id IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_access_formacao_backoffice(p_escola_id) THEN
    RAISE EXCEPTION 'Sem permissão para criar inscrição' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_cohort
  FROM public.formacao_cohorts c
  WHERE c.escola_id = p_escola_id
    AND c.id = p_cohort_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COHORT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_modalidade := nullif(btrim(coalesce(p_modalidade, '')), '');
  IF v_modalidade IS NULL THEN
    SELECT fc.modalidade
    INTO v_modalidade
    FROM public.formacao_cursos fc
    WHERE fc.escola_id = p_escola_id
      AND fc.nome = v_cohort.curso_nome
    ORDER BY fc.updated_at DESC
    LIMIT 1;
  END IF;
  v_modalidade := coalesce(v_modalidade, 'presencial');

  IF v_modalidade = 'presencial' THEN
    SELECT count(*)::int
    INTO v_ocupacao
    FROM public.formacao_inscricoes fi
    WHERE fi.escola_id = p_escola_id
      AND fi.cohort_id = p_cohort_id
      AND fi.estado IN ('pre_inscrito', 'inscrito');

    IF v_ocupacao >= v_cohort.vagas THEN
      RAISE EXCEPTION 'TURMA_ESGOTADA' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT p.nome, p.email, p.bi_numero, p.telefone
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_formando_user_id
  LIMIT 1;

  INSERT INTO public.formacao_inscricoes (
    escola_id,
    cohort_id,
    formando_user_id,
    origem,
    estado,
    status_pagamento,
    modalidade,
    valor_cobrado,
    nome_snapshot,
    email_snapshot,
    bi_snapshot,
    telefone_snapshot,
    created_by
  )
  VALUES (
    p_escola_id,
    p_cohort_id,
    p_formando_user_id,
    coalesce(nullif(btrim(p_origem), ''), 'balcao'),
    'inscrito',
    CASE WHEN coalesce(p_valor_cobrado, 0) > 0 THEN 'pendente' ELSE 'pago' END,
    v_modalidade,
    greatest(coalesce(p_valor_cobrado, 0), 0),
    coalesce(nullif(btrim(p_nome_snapshot), ''), v_profile.nome),
    coalesce(nullif(btrim(p_email_snapshot), ''), v_profile.email),
    coalesce(nullif(btrim(p_bi_snapshot), ''), v_profile.bi_numero),
    coalesce(nullif(btrim(p_telefone_snapshot), ''), v_profile.telefone),
    coalesce(p_created_by, auth.uid())
  )
  ON CONFLICT (escola_id, cohort_id, formando_user_id) DO NOTHING
  RETURNING *
  INTO v_existing;

  IF v_existing.id IS NULL THEN
    SELECT *
    INTO v_existing
    FROM public.formacao_inscricoes fi
    WHERE fi.escola_id = p_escola_id
      AND fi.cohort_id = p_cohort_id
      AND fi.formando_user_id = p_formando_user_id;
  END IF;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_create_inscricao(
  uuid, uuid, uuid, text, text, uuid, text, text, text, text, numeric
) TO authenticated;

COMMIT;
