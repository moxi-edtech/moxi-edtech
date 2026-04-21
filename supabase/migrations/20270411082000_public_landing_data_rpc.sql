BEGIN;

CREATE OR REPLACE FUNCTION public.get_public_landing_data(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola record;
  v_payload jsonb;
BEGIN
  SELECT e.id, e.nome, e.slug, e.logo_url, e.tenant_type
    INTO v_escola
    FROM public.escolas e
   WHERE e.slug = nullif(btrim(coalesce(p_slug, '')), '')
     AND e.tenant_type IN ('formacao', 'solo_creator')
   LIMIT 1;

  IF v_escola.id IS NULL THEN
    RETURN NULL;
  END IF;

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
        -- "publicado" no produto corresponde ao estado técnico "ativo" no schema atual.
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
    'fiscal', NULL::jsonb,
    'cohorts', coalesce((SELECT jsonb_agg(to_jsonb(cp)) FROM cohorts_public cp), '[]'::jsonb)
  )
  INTO v_payload;

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_landing_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_landing_data(text) TO anon, authenticated;

COMMIT;
