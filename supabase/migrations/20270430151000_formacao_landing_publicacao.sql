BEGIN;

ALTER TABLE public.centros_formacao
  ADD COLUMN IF NOT EXISTS landing_config jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'centros_formacao_landing_config_object_chk'
      AND conrelid = 'public.centros_formacao'::regclass
  ) THEN
    ALTER TABLE public.centros_formacao
      ADD CONSTRAINT centros_formacao_landing_config_object_chk
      CHECK (jsonb_typeof(landing_config) = 'object') NOT VALID;
  END IF;
END $$;

ALTER TABLE public.centros_formacao
  VALIDATE CONSTRAINT centros_formacao_landing_config_object_chk;

CREATE OR REPLACE FUNCTION public.formacao_update_landing_config(
  p_escola_id uuid,
  p_config jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_escola_id IS NULL THEN
    RAISE EXCEPTION 'escola_id obrigatório';
  END IF;

  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['formacao_admin', 'formacao_secretaria', 'super_admin', 'global_admin']::text[]
  ) THEN
    RAISE EXCEPTION 'sem permissão para atualizar publicação';
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'landing_config inválido';
  END IF;

  INSERT INTO public.centros_formacao (escola_id, nome, landing_config)
  SELECT p_escola_id, e.nome, p_config
  FROM public.escolas e
  WHERE e.id = p_escola_id
  ON CONFLICT (escola_id)
  DO UPDATE SET
    landing_config = EXCLUDED.landing_config,
    updated_at = now()
  RETURNING landing_config INTO v_result;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.formacao_update_landing_config(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formacao_update_landing_config(uuid, jsonb) TO authenticated;

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
  v_publicacao jsonb := '{}'::jsonb;
  v_payload jsonb;
BEGIN
  SELECT
      e.id,
      e.nome,
      e.slug,
      e.logo_url,
      e.tenant_type,
      coalesce(cf.dados_pagamento, '{}'::jsonb) AS dados_pagamento,
      coalesce(cf.tracking_config, '{}'::jsonb) AS tracking_config,
      coalesce(cf.seo_config, '{}'::jsonb) AS seo_config,
      coalesce(cf.landing_config, '{}'::jsonb) AS landing_config,
      cf.morada,
      cf.municipio,
      cf.provincia,
      cf.telefone,
      cf.email,
      cf.website
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

  v_publicacao := v_escola.landing_config
    || jsonb_build_object(
      'contactos',
      coalesce(v_escola.landing_config->'contactos', '{}'::jsonb)
        || jsonb_build_object(
          'telefone', coalesce(nullif(v_escola.landing_config #>> '{contactos,telefone}', ''), nullif(v_escola.telefone, '')),
          'email', coalesce(nullif(v_escola.landing_config #>> '{contactos,email}', ''), nullif(v_escola.email, '')),
          'endereco', coalesce(nullif(v_escola.landing_config #>> '{contactos,endereco}', ''), nullif(v_escola.morada, ''))
        ),
      'redes_sociais',
      coalesce(v_escola.landing_config->'redes_sociais', '{}'::jsonb)
        || jsonb_build_object(
          'website', coalesce(nullif(v_escola.landing_config #>> '{redes_sociais,website}', ''), nullif(v_escola.website, ''))
        )
    );

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
  ),
  testemunhos_agg AS (
    SELECT jsonb_agg(to_jsonb(t)) AS items
    FROM (
      SELECT autor_nome, autor_cargo, autor_avatar_url, conteudo, estrelas, curso_nome
      FROM public.formacao_testemunhos
      WHERE escola_id = v_escola.id
        AND status = 'ativo'
      ORDER BY created_at DESC
      LIMIT 6
    ) t
  )
  SELECT jsonb_build_object(
    'escola',
    jsonb_build_object(
      'id', v_escola.id,
      'nome', v_escola.nome,
      'slug', v_escola.slug,
      'logo_url', v_escola.logo_url,
      'tenant_type', v_escola.tenant_type,
      'municipio', v_escola.municipio,
      'provincia', v_escola.provincia
    ),
    'fiscal',
    CASE
      WHEN coalesce(v_pagamento->>'iban', '') <> ''
        THEN jsonb_build_object('iban', v_pagamento->>'iban')
      ELSE NULL::jsonb
    END,
    'pagamento', v_pagamento,
    'publicacao', v_publicacao,
    'tracking', v_escola.tracking_config,
    'seo', v_escola.seo_config,
    'testemunhos', coalesce((SELECT items FROM testemunhos_agg), '[]'::jsonb),
    'cohorts', coalesce((SELECT jsonb_agg(to_jsonb(cp)) FROM cohorts_public cp), '[]'::jsonb)
  )
  INTO v_payload;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_data(text) TO anon, authenticated;

COMMIT;
