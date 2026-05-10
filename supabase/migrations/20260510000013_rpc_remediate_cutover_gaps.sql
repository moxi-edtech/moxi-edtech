BEGIN;

CREATE OR REPLACE FUNCTION public.remediate_cutover_gaps(
  p_escola_id uuid,
  p_action text,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_active_ano int;
  v_start_month int;
  v_start_year int;
  v_end_year int;
  v_orphans int := 0;
  v_orphans_with_candidate int := 0;
  v_dedup_deleted int := 0;
  v_updated int := 0;
  v_conflicts int := 0;
BEGIN
  IF v_tenant_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_tenant_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido.';
  END IF;

  SELECT public.user_has_role_in_school(v_tenant_escola_id, ARRAY['admin', 'admin_escola', 'secretaria'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: permissao negada.';
  END IF;

  IF p_action NOT IN ('orphan_mensalidades', 'competencia_mensalidades') THEN
    RAISE EXCEPTION 'VALIDATION: action invalida (%).', p_action;
  END IF;

  IF p_action = 'orphan_mensalidades' THEN
    WITH orfas AS (
      SELECT ms.id, ms.escola_id, ms.aluno_id, ms.turma_id, ms.ano_letivo, ms.ano_referencia, ms.mes_referencia, ms.created_at
      FROM public.mensalidades ms
      LEFT JOIN public.matriculas mx ON mx.id = ms.matricula_id
      WHERE ms.escola_id = p_escola_id
        AND mx.id IS NULL
    ), mapped AS (
      SELECT o.id AS orphan_id, m.id AS target_matricula_id, o.ano_referencia, o.mes_referencia, o.created_at
      FROM orfas o
      JOIN public.matriculas m
        ON m.escola_id = o.escola_id
       AND m.aluno_id = o.aluno_id
       AND m.turma_id = o.turma_id
       AND m.ano_letivo::text = o.ano_letivo
    ), ranked AS (
      SELECT *,
             row_number() OVER (
               PARTITION BY target_matricula_id, ano_referencia, mes_referencia
               ORDER BY created_at DESC, orphan_id DESC
             ) AS rn
      FROM mapped
    )
    SELECT
      (SELECT count(*) FROM orfas),
      (SELECT count(*) FROM mapped),
      (SELECT count(*) FROM ranked WHERE rn > 1)
    INTO v_orphans, v_orphans_with_candidate, v_dedup_deleted;

    IF p_dry_run THEN
      RETURN jsonb_build_object(
        'ok', true,
        'action', p_action,
        'dry_run', true,
        'orphans_total', v_orphans,
        'orphans_with_candidate', v_orphans_with_candidate,
        'duplicates_to_delete', v_dedup_deleted
      );
    END IF;

    WITH orfas AS (
      SELECT ms.id, ms.escola_id, ms.aluno_id, ms.turma_id, ms.ano_letivo, ms.ano_referencia, ms.mes_referencia, ms.created_at
      FROM public.mensalidades ms
      LEFT JOIN public.matriculas mx ON mx.id = ms.matricula_id
      WHERE ms.escola_id = p_escola_id
        AND mx.id IS NULL
    ), mapped AS (
      SELECT o.id AS orphan_id, m.id AS target_matricula_id, o.ano_referencia, o.mes_referencia, o.created_at
      FROM orfas o
      JOIN public.matriculas m
        ON m.escola_id = o.escola_id
       AND m.aluno_id = o.aluno_id
       AND m.turma_id = o.turma_id
       AND m.ano_letivo::text = o.ano_letivo
    ), ranked AS (
      SELECT *,
             row_number() OVER (
               PARTITION BY target_matricula_id, ano_referencia, mes_referencia
               ORDER BY created_at DESC, orphan_id DESC
             ) AS rn
      FROM mapped
    ), del AS (
      DELETE FROM public.mensalidades ms
      USING ranked r
      WHERE ms.id = r.orphan_id
        AND r.rn > 1
      RETURNING ms.id
    )
    SELECT count(*) INTO v_dedup_deleted FROM del;

    WITH orfas AS (
      SELECT ms.id, ms.escola_id, ms.aluno_id, ms.turma_id, ms.ano_letivo, ms.ano_referencia, ms.mes_referencia, ms.created_at
      FROM public.mensalidades ms
      LEFT JOIN public.matriculas mx ON mx.id = ms.matricula_id
      WHERE ms.escola_id = p_escola_id
        AND mx.id IS NULL
    ), mapped AS (
      SELECT o.id AS orphan_id, m.id AS target_matricula_id
      FROM orfas o
      JOIN public.matriculas m
        ON m.escola_id = o.escola_id
       AND m.aluno_id = o.aluno_id
       AND m.turma_id = o.turma_id
       AND m.ano_letivo::text = o.ano_letivo
    ), upd AS (
      UPDATE public.mensalidades ms
      SET matricula_id = m.target_matricula_id,
          updated_at = now()
      FROM mapped m
      WHERE ms.id = m.orphan_id
      RETURNING ms.id
    )
    SELECT count(*) INTO v_updated FROM upd;

    RETURN jsonb_build_object(
      'ok', true,
      'action', p_action,
      'dry_run', false,
      'orphans_total', v_orphans,
      'updated', v_updated,
      'duplicates_deleted', v_dedup_deleted
    );
  END IF;

  SELECT ano, EXTRACT(MONTH FROM data_inicio)::int, EXTRACT(YEAR FROM data_inicio)::int, EXTRACT(YEAR FROM data_fim)::int
  INTO v_active_ano, v_start_month, v_start_year, v_end_year
  FROM public.anos_letivos
  WHERE escola_id = p_escola_id
    AND ativo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_active_ano IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: sem ano letivo ativo.';
  END IF;

  WITH out_window AS (
    SELECT m.id, m.matricula_id, m.mes_referencia,
           CASE WHEN m.mes_referencia >= v_start_month THEN v_start_year ELSE v_end_year END AS target_year
    FROM public.mensalidades m
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo = v_active_ano::text
      AND ((COALESCE(m.ano_referencia, v_active_ano) * 100 + COALESCE(m.mes_referencia, 1)) < (v_start_year * 100 + v_start_month)
        OR (COALESCE(m.ano_referencia, v_active_ano) * 100 + COALESCE(m.mes_referencia, 1)) > (v_end_year * 100 + EXTRACT(MONTH FROM (SELECT data_fim FROM public.anos_letivos WHERE escola_id = p_escola_id AND ativo = true ORDER BY created_at DESC LIMIT 1))::int))
  ), conflicts AS (
    SELECT ow.id
    FROM out_window ow
    JOIN public.mensalidades x
      ON x.escola_id = p_escola_id
     AND x.matricula_id = ow.matricula_id
     AND x.ano_referencia = ow.target_year
     AND x.mes_referencia = ow.mes_referencia
     AND x.id <> ow.id
  )
  SELECT (SELECT count(*) FROM out_window), (SELECT count(*) FROM conflicts) INTO v_updated, v_conflicts;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'ok', true,
      'action', p_action,
      'dry_run', true,
      'outside_window_total', v_updated,
      'conflicts', v_conflicts
    );
  END IF;

  WITH out_window AS (
    SELECT m.id,
           CASE WHEN m.mes_referencia >= v_start_month THEN v_start_year ELSE v_end_year END AS target_year
    FROM public.mensalidades m
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo = v_active_ano::text
      AND ((COALESCE(m.ano_referencia, v_active_ano) * 100 + COALESCE(m.mes_referencia, 1)) < (v_start_year * 100 + v_start_month)
        OR (COALESCE(m.ano_referencia, v_active_ano) * 100 + COALESCE(m.mes_referencia, 1)) > (v_end_year * 100 + EXTRACT(MONTH FROM (SELECT data_fim FROM public.anos_letivos WHERE escola_id = p_escola_id AND ativo = true ORDER BY created_at DESC LIMIT 1))::int))
  ), conflicts AS (
    SELECT ow.id
    FROM out_window ow
    JOIN public.mensalidades x
      ON x.escola_id = p_escola_id
     AND x.matricula_id = (SELECT m2.matricula_id FROM public.mensalidades m2 WHERE m2.id = ow.id)
     AND x.ano_referencia = ow.target_year
     AND x.mes_referencia = (SELECT m2.mes_referencia FROM public.mensalidades m2 WHERE m2.id = ow.id)
     AND x.id <> ow.id
  ), del AS (
    DELETE FROM public.mensalidades m
    USING conflicts c
    WHERE m.id = c.id
    RETURNING m.id
  ), upd AS (
    UPDATE public.mensalidades m
    SET ano_referencia = ow.target_year,
        updated_at = now()
    FROM out_window ow
    WHERE m.id = ow.id
      AND NOT EXISTS (SELECT 1 FROM conflicts c WHERE c.id = ow.id)
    RETURNING m.id
  )
  SELECT (SELECT count(*) FROM upd), (SELECT count(*) FROM del) INTO v_updated, v_dedup_deleted;

  RETURN jsonb_build_object(
    'ok', true,
    'action', p_action,
    'dry_run', false,
    'updated', v_updated,
    'deleted_conflicts', v_dedup_deleted
  );
END;
$$;

COMMIT;
