-- Legacy template compatibility: the 2025/2026 MED seed only has PROVA_TRIMESTRAL
-- items. Source-backed 2026/2027 calendars still require PERIODO_LETIVO.
-- The existing tenant, roles, and audit requirements are unchanged.

CREATE OR REPLACE FUNCTION public.upsert_bulk_periodos_letivos(p_escola_id uuid, p_periodos_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_periodo_data jsonb;
  v_old_record public.periodos_letivos;
  v_new_record public.periodos_letivos;
  v_results jsonb[] := '{}';
  v_actor_id uuid := auth.uid();
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_with_source boolean;
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
    INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;
  IF jsonb_typeof(p_periodos_data) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados de períodos inválidos: é necessária uma lista.';
  END IF;

  FOR v_periodo_data IN SELECT * FROM jsonb_array_elements(p_periodos_data) LOOP
    v_with_source :=
      nullif(v_periodo_data->>'source_template_id','') IS NOT NULL
      OR nullif(v_periodo_data->>'source_item_id','') IS NOT NULL;
    IF v_with_source THEN
      IF nullif(v_periodo_data->>'source_template_id','') IS NULL
         OR nullif(v_periodo_data->>'source_item_id','') IS NULL THEN
        RAISE EXCEPTION 'O período oficial requer template e item de origem.';
      END IF;
      PERFORM 1
      FROM public.calendario_template_items i
      JOIN public.calendario_templates t ON t.id = i.template_id
      JOIN public.anos_letivos a ON a.id = (v_periodo_data->>'ano_letivo_id')::uuid
      WHERE i.id = (v_periodo_data->>'source_item_id')::uuid
        AND t.id = (v_periodo_data->>'source_template_id')::uuid
        AND t.ano_base = a.ano
        AND t.is_oficial = true AND t.estado = 'PUBLICADO'
        AND a.escola_id = v_escola_id
        AND (
          i.tipo::text = 'PERIODO_LETIVO'
          OR (
            i.tipo::text = 'PROVA_TRIMESTRAL'
            AND t.ano_base < 2026
            AND NOT EXISTS (
              SELECT 1 FROM public.calendario_template_items official_period
              WHERE official_period.template_id = t.id
                AND official_period.tipo::text = 'PERIODO_LETIVO'
            )
          )
        )
        AND i.numero = (v_periodo_data->>'numero')::int
        AND i.data_inicio = (v_periodo_data->>'data_inicio')::date
        AND i.data_fim = (v_periodo_data->>'data_fim')::date;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Período não corresponde ao decreto oficial publicado para o ano.';
      END IF;
    END IF;

    IF v_periodo_data ? 'id' THEN
      SELECT * INTO v_old_record
      FROM public.periodos_letivos
      WHERE id = (v_periodo_data->>'id')::uuid AND escola_id = v_escola_id;
    ELSE
      v_old_record := NULL;
    END IF;

    INSERT INTO public.periodos_letivos (
      id, escola_id, ano_letivo_id, tipo, numero, data_inicio, data_fim,
      trava_notas_em, peso, source_template_id, source_item_id,
      source_version, applied_at, applied_by
    )
    VALUES (
      COALESCE((v_periodo_data->>'id')::uuid, gen_random_uuid()),
      v_escola_id,
      (v_periodo_data->>'ano_letivo_id')::uuid,
      (v_periodo_data->>'tipo')::periodo_tipo,
      (v_periodo_data->>'numero')::int,
      (v_periodo_data->>'data_inicio')::date,
      (v_periodo_data->>'data_fim')::date,
      (v_periodo_data->>'trava_notas_em')::timestamptz,
      (v_periodo_data->>'peso')::smallint,
      CASE WHEN v_with_source THEN (v_periodo_data->>'source_template_id')::uuid ELSE NULL END,
      CASE WHEN v_with_source THEN (v_periodo_data->>'source_item_id')::uuid ELSE NULL END,
      CASE WHEN v_with_source THEN v_periodo_data->>'source_version' ELSE NULL END,
      CASE WHEN v_with_source THEN now() ELSE NULL END,
      CASE WHEN v_with_source THEN v_actor_id ELSE NULL END
    )
    ON CONFLICT (escola_id, ano_letivo_id, tipo, numero) DO UPDATE SET
      data_inicio = EXCLUDED.data_inicio,
      data_fim = EXCLUDED.data_fim,
      trava_notas_em = EXCLUDED.trava_notas_em,
      peso = EXCLUDED.peso,
      source_template_id = CASE
        WHEN EXCLUDED.source_item_id IS NOT NULL THEN EXCLUDED.source_template_id
        WHEN public.periodos_letivos.data_inicio IS NOT DISTINCT FROM EXCLUDED.data_inicio
          AND public.periodos_letivos.data_fim IS NOT DISTINCT FROM EXCLUDED.data_fim
        THEN public.periodos_letivos.source_template_id ELSE NULL END,
      source_item_id = CASE
        WHEN EXCLUDED.source_item_id IS NOT NULL THEN EXCLUDED.source_item_id
        WHEN public.periodos_letivos.data_inicio IS NOT DISTINCT FROM EXCLUDED.data_inicio
          AND public.periodos_letivos.data_fim IS NOT DISTINCT FROM EXCLUDED.data_fim
        THEN public.periodos_letivos.source_item_id ELSE NULL END,
      source_version = CASE
        WHEN EXCLUDED.source_item_id IS NOT NULL THEN EXCLUDED.source_version
        WHEN public.periodos_letivos.data_inicio IS NOT DISTINCT FROM EXCLUDED.data_inicio
          AND public.periodos_letivos.data_fim IS NOT DISTINCT FROM EXCLUDED.data_fim
        THEN public.periodos_letivos.source_version ELSE NULL END,
      applied_at = CASE
        WHEN EXCLUDED.source_item_id IS NOT NULL THEN EXCLUDED.applied_at
        WHEN public.periodos_letivos.data_inicio IS NOT DISTINCT FROM EXCLUDED.data_inicio
          AND public.periodos_letivos.data_fim IS NOT DISTINCT FROM EXCLUDED.data_fim
        THEN public.periodos_letivos.applied_at ELSE NULL END,
      applied_by = CASE
        WHEN EXCLUDED.source_item_id IS NOT NULL THEN EXCLUDED.applied_by
        WHEN public.periodos_letivos.data_inicio IS NOT DISTINCT FROM EXCLUDED.data_inicio
          AND public.periodos_letivos.data_fim IS NOT DISTINCT FROM EXCLUDED.data_fim
        THEN public.periodos_letivos.applied_by ELSE NULL END,
      updated_at = now()
    RETURNING * INTO v_new_record;

    v_results := array_append(v_results, to_jsonb(v_new_record));
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
    VALUES (
      v_escola_id, v_actor_id,
      CASE WHEN v_old_record IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
      'periodos_letivos', v_new_record.id::text,
      to_jsonb(v_old_record), to_jsonb(v_new_record), 'admin'
    );
  END LOOP;

  RETURN jsonb_build_object('data', v_results);
END;
$function$

