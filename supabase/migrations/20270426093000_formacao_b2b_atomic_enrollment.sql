CREATE OR REPLACE FUNCTION public.formacao_corporate_enroll_atomic(
  p_contrato_id uuid,
  p_b2b_token text,
  p_formando_user_id uuid,
  p_nome_snapshot text DEFAULT NULL,
  p_email_snapshot text DEFAULT NULL,
  p_bi_snapshot text DEFAULT NULL,
  p_telefone_snapshot text DEFAULT NULL
)
RETURNS public.formacao_inscricoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato public.formacao_contratos_b2b%ROWTYPE;
  v_cohort public.formacao_cohorts%ROWTYPE;
  v_modalidade text;
  v_ocupacao integer;
  v_profile record;
  v_inscricao public.formacao_inscricoes%ROWTYPE;
BEGIN
  IF p_contrato_id IS NULL
     OR nullif(btrim(coalesce(p_b2b_token, '')), '') IS NULL
     OR p_formando_user_id IS NULL THEN
    RAISE EXCEPTION 'PARAMS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_contrato
  FROM public.formacao_contratos_b2b c
  WHERE c.id = p_contrato_id
    AND c.b2b_token = btrim(p_b2b_token)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRATO_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_contrato.status <> 'PAGO' THEN
    RAISE EXCEPTION 'CONTRATO_NOT_PAID' USING ERRCODE = 'P0001';
  END IF;

  IF coalesce(v_contrato.vagas_utilizadas, 0) >= coalesce(v_contrato.vagas_compradas, 0) THEN
    RAISE EXCEPTION 'CORPORATE_QUOTA_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_cohort
  FROM public.formacao_cohorts c
  WHERE c.escola_id = v_contrato.escola_id
    AND c.id = v_contrato.cohort_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COHORT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT fc.modalidade
  INTO v_modalidade
  FROM public.formacao_cursos fc
  WHERE fc.escola_id = v_contrato.escola_id
    AND fc.nome = v_cohort.curso_nome
  ORDER BY fc.updated_at DESC
  LIMIT 1;
  v_modalidade := coalesce(nullif(btrim(coalesce(v_modalidade, '')), ''), 'presencial');

  IF v_modalidade = 'presencial' THEN
    SELECT count(*)::int
    INTO v_ocupacao
    FROM public.formacao_inscricoes fi
    WHERE fi.escola_id = v_contrato.escola_id
      AND fi.cohort_id = v_contrato.cohort_id
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
    v_contrato.escola_id,
    v_contrato.cohort_id,
    p_formando_user_id,
    'self_service',
    'inscrito',
    'pago',
    v_modalidade,
    0,
    coalesce(nullif(btrim(coalesce(p_nome_snapshot, '')), ''), v_profile.nome),
    coalesce(nullif(lower(btrim(coalesce(p_email_snapshot, ''))), ''), v_profile.email),
    coalesce(nullif(btrim(coalesce(p_bi_snapshot, '')), ''), v_profile.bi_numero),
    coalesce(nullif(btrim(coalesce(p_telefone_snapshot, '')), ''), v_profile.telefone),
    auth.uid()
  )
  ON CONFLICT (escola_id, cohort_id, formando_user_id) DO NOTHING
  RETURNING *
  INTO v_inscricao;

  IF v_inscricao.id IS NULL THEN
    SELECT *
    INTO v_inscricao
    FROM public.formacao_inscricoes fi
    WHERE fi.escola_id = v_contrato.escola_id
      AND fi.cohort_id = v_contrato.cohort_id
      AND fi.formando_user_id = p_formando_user_id
    LIMIT 1;

    RETURN v_inscricao;
  END IF;

  UPDATE public.formacao_contratos_b2b
  SET vagas_utilizadas = coalesce(vagas_utilizadas, 0) + 1,
      updated_at = now()
  WHERE id = v_contrato.id;

  RETURN v_inscricao;
END;
$$;

GRANT EXECUTE ON FUNCTION public.formacao_corporate_enroll_atomic(
  uuid, text, uuid, text, text, text, text
) TO anon, authenticated;
