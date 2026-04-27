BEGIN;

CREATE OR REPLACE FUNCTION public.get_partner_talent_pool(
  p_escola_slug text,
  p_q text DEFAULT NULL,
  p_scope text DEFAULT 'local',
  p_limit integer DEFAULT 12,
  p_offset integer DEFAULT 0,
  p_min_media numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola record;
  v_q text := nullif(lower(btrim(coalesce(p_q, ''))), '');
  v_scope text := lower(coalesce(p_scope, 'local'));
  v_limit integer := LEAST(GREATEST(coalesce(p_limit, 12), 1), 50);
  v_offset integer := GREATEST(coalesce(p_offset, 0), 0);
  v_local_count integer := 0;
  v_global_count integer := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT
    e.id,
    e.nome,
    e.slug,
    e.tenant_type,
    e.cor_primaria,
    cf.logo_url
  INTO v_escola
  FROM public.escolas e
  LEFT JOIN public.centros_formacao cf
    ON cf.escola_id = e.id
  WHERE e.slug = lower(btrim(coalesce(p_escola_slug, '')))
  LIMIT 1;

  IF v_escola.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'PARCEIRO_NAO_ENCONTRADO'
    );
  END IF;

  -- Count Local
  SELECT count(*)::int
  INTO v_local_count
  FROM public.alunos a
  WHERE a.escola_id = v_escola.id
    AND a.is_open_to_work IS TRUE
    AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
    AND (
      v_q IS NULL OR (
        lower(coalesce(a.career_headline, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.provincia, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.municipio, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.preferencia_trabalho, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.anonymous_slug, '')) LIKE '%' || v_q || '%'
      )
    );

  -- Count Global
  SELECT count(*)::int
  INTO v_global_count
  FROM public.alunos a
  WHERE a.is_open_to_work IS TRUE
    AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
    AND (
      v_q IS NULL OR (
        lower(coalesce(a.career_headline, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.provincia, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.municipio, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.preferencia_trabalho, '')) LIKE '%' || v_q || '%'
        OR lower(coalesce(a.anonymous_slug, '')) LIKE '%' || v_q || '%'
      )
    );

  IF v_scope = 'global' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT
        a.id AS aluno_id,
        a.escola_id,
        e.nome AS escola_nome,
        e.slug AS escola_slug,
        a.provincia,
        a.municipio,
        a.preferencia_trabalho,
        a.career_headline,
        a.skills_tags,
        a.anonymous_slug,
        (SELECT max(m.media_final) FROM public.matriculas m WHERE m.aluno_id = a.id) as highest_media
      FROM public.alunos a
      JOIN public.escolas e ON e.id = a.escola_id
      WHERE a.is_open_to_work IS TRUE
        AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
        AND (p_min_media IS NULL OR (SELECT max(m.media_final) FROM public.matriculas m WHERE m.aluno_id = a.id) >= p_min_media)
        AND (
          v_q IS NULL OR (
            lower(coalesce(a.career_headline, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.provincia, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.municipio, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.preferencia_trabalho, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.anonymous_slug, '')) LIKE '%' || v_q || '%'
          )
        )
      ORDER BY highest_media DESC NULLS LAST, a.updated_at DESC NULLS LAST
      LIMIT v_limit
      OFFSET v_offset
    ) t;
  ELSE
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT
        a.id AS aluno_id,
        a.escola_id,
        v_escola.nome::text AS escola_nome,
        v_escola.slug::text AS escola_slug,
        a.provincia,
        a.municipio,
        a.preferencia_trabalho,
        a.career_headline,
        a.skills_tags,
        a.anonymous_slug,
        (SELECT max(m.media_final) FROM public.matriculas m WHERE m.aluno_id = a.id) as highest_media
      FROM public.alunos a
      WHERE a.escola_id = v_escola.id
        AND a.is_open_to_work IS TRUE
        AND nullif(btrim(coalesce(a.anonymous_slug, '')), '') IS NOT NULL
        AND (p_min_media IS NULL OR (SELECT max(m.media_final) FROM public.matriculas m WHERE m.aluno_id = a.id) >= p_min_media)
        AND (
          v_q IS NULL OR (
            lower(coalesce(a.career_headline, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.provincia, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.municipio, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.preferencia_trabalho, '')) LIKE '%' || v_q || '%'
            OR lower(coalesce(a.anonymous_slug, '')) LIKE '%' || v_q || '%'
          )
        )
      ORDER BY highest_media DESC NULLS LAST, a.updated_at DESC NULLS LAST
      LIMIT v_limit
      OFFSET v_offset
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'partner', jsonb_build_object(
      'escola_id', v_escola.id,
      'nome', v_escola.nome,
      'slug', v_escola.slug,
      'tenant_type', v_escola.tenant_type,
      'cor_primaria', v_escola.cor_primaria,
      'logo_url', v_escola.logo_url
    ),
    'scope', CASE WHEN v_scope = 'global' THEN 'global' ELSE 'local' END,
    'query', v_q,
    'local_count', v_local_count,
    'global_count', v_global_count,
    'items', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_talent_pool(text, text, text, integer, integer, numeric) TO anon, authenticated;

COMMIT;
