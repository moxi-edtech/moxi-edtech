BEGIN;

ALTER TABLE public.centros_formacao
  ADD COLUMN IF NOT EXISTS dados_pagamento jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.centros_formacao
  ADD CONSTRAINT centros_formacao_dados_pagamento_object_chk
  CHECK (jsonb_typeof(dados_pagamento) = 'object') NOT VALID;

ALTER TABLE public.centros_formacao
  VALIDATE CONSTRAINT centros_formacao_dados_pagamento_object_chk;

CREATE OR REPLACE FUNCTION public.formacao_update_dados_pagamento(
  p_escola_id uuid,
  p_dados jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nome text;
  v_result jsonb;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id obrigatório';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['formacao_admin', 'formacao_financeiro', 'super_admin', 'global_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION 'dados_pagamento inválido';
  END IF;

  SELECT e.nome
    INTO v_nome
    FROM public.escolas e
   WHERE e.id = p_escola_id
   LIMIT 1;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Centro não encontrado';
  END IF;

  INSERT INTO public.centros_formacao (escola_id, nome, dados_pagamento)
  VALUES (p_escola_id, v_nome, p_dados)
  ON CONFLICT (escola_id)
  DO UPDATE SET
    dados_pagamento = EXCLUDED.dados_pagamento,
    updated_at = now()
  RETURNING dados_pagamento INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.formacao_update_dados_pagamento(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formacao_update_dados_pagamento(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_landing_data(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola record;
  v_pagamento jsonb := '{}'::jsonb;
  v_payload jsonb;
BEGIN
  SELECT
      e.id,
      e.nome,
      e.slug,
      e.logo_url,
      e.tenant_type,
      coalesce(cf.dados_pagamento, '{}'::jsonb) AS dados_pagamento
    INTO v_escola
    FROM public.escolas e
    LEFT JOIN public.centros_formacao cf
      ON cf.escola_id = e.id
   WHERE e.slug = nullif(btrim(coalesce(p_slug, '')), '')
     AND e.tenant_type IN ('formacao', 'solo_creator')
   LIMIT 1;

  IF v_escola.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_pagamento := CASE
    WHEN coalesce((v_escola.dados_pagamento->>'ativo')::boolean, false) THEN
      jsonb_build_object(
        'ativo', true,
        'banco', nullif(v_escola.dados_pagamento->>'banco', ''),
        'titular_conta', nullif(v_escola.dados_pagamento->>'titular_conta', ''),
        'iban', nullif(v_escola.dados_pagamento->>'iban', ''),
        'numero_conta', nullif(v_escola.dados_pagamento->>'numero_conta', ''),
        'kwik_chave', nullif(v_escola.dados_pagamento->>'kwik_chave', ''),
        'instrucoes_checkout', nullif(v_escola.dados_pagamento->>'instrucoes_checkout', '')
      )
    ELSE jsonb_build_object('ativo', false)
  END;

  WITH cohorts_public AS (
    SELECT
      c.id,
      c.codigo,
      c.nome,
      c.curso_nome,
      CASE
        WHEN upper(coalesce(crs.modalidade, '')) IN ('ONLINE', 'GRAVADO', 'PRESENCIAL')
          THEN upper(crs.modalidade)
        ELSE 'PRESENCIAL'
      END AS format,
      c.vagas,
      c.data_inicio,
      coalesce(fin.valor_referencia, 0)::numeric AS valor_referencia,
      coalesce(occ.vagas_ocupadas, 0)::int AS vagas_ocupadas,
      coalesce(crs.carga_horaria, 0)::int AS carga_horaria
    FROM public.formacao_cohorts c
    LEFT JOIN LATERAL (
      SELECT f.valor_referencia
      FROM public.formacao_cohort_financeiro f
      WHERE f.escola_id = v_escola.id
        AND f.cohort_id = c.id
      ORDER BY f.updated_at DESC NULLS LAST
      LIMIT 1
    ) fin ON true
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS vagas_ocupadas
      FROM public.formacao_inscricoes fi
      WHERE fi.escola_id = v_escola.id
        AND fi.cohort_id = c.id
        AND fi.estado IN ('pre_inscrito', 'inscrito')
        AND fi.cancelled_at IS NULL
    ) occ ON true
    LEFT JOIN LATERAL (
      SELECT fc.carga_horaria, fc.modalidade
      FROM public.formacao_cursos fc
      WHERE fc.escola_id = v_escola.id
        AND fc.nome = c.curso_nome
        AND fc.status = 'ativo'
      ORDER BY fc.updated_at DESC NULLS LAST
      LIMIT 1
    ) crs ON true
    WHERE c.escola_id = v_escola.id
      AND c.status = 'aberta'
      AND EXISTS (
        SELECT 1
        FROM public.formacao_cursos fc_public
        WHERE fc_public.escola_id = v_escola.id
          AND fc_public.nome = c.curso_nome
          AND fc_public.status = 'ativo'
      )
    ORDER BY c.data_inicio ASC
  )
  SELECT jsonb_build_object(
    'escola',
    jsonb_build_object(
      'id', v_escola.id,
      'nome', v_escola.nome,
      'slug', v_escola.slug,
      'logo_url', v_escola.logo_url,
      'tenant_type', v_escola.tenant_type
    ),
    'fiscal',
    CASE
      WHEN coalesce(v_pagamento->>'iban', '') <> ''
        THEN jsonb_build_object('iban', v_pagamento->>'iban')
      ELSE NULL::jsonb
    END,
    'pagamento', v_pagamento,
    'cohorts', coalesce((SELECT jsonb_agg(to_jsonb(cp)) FROM cohorts_public cp), '[]'::jsonb)
  )
  INTO v_payload;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_data(text) TO anon, authenticated;

COMMIT;
