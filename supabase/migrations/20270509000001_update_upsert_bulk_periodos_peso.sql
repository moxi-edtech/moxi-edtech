-- Update upsert_bulk_periodos_letivos to support 'peso'
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
BEGIN
  IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
  INTO v_has_permission;
  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  FOR v_periodo_data IN SELECT * FROM jsonb_array_elements(p_periodos_data) LOOP
    IF v_periodo_data ? 'id' THEN
      SELECT * INTO v_old_record
      FROM public.periodos_letivos
      WHERE id = (v_periodo_data->>'id')::uuid AND escola_id = v_escola_id;
    ELSE
      v_old_record := NULL;
    END IF;

    INSERT INTO public.periodos_letivos (
      id,
      escola_id,
      ano_letivo_id,
      tipo,
      numero,
      data_inicio,
      data_fim,
      trava_notas_em,
      peso
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
      (v_periodo_data->>'peso')::smallint
    )
    ON CONFLICT (escola_id, ano_letivo_id, tipo, numero) DO UPDATE SET
      data_inicio = EXCLUDED.data_inicio,
      data_fim = EXCLUDED.data_fim,
      trava_notas_em = EXCLUDED.trava_notas_em,
      peso = EXCLUDED.peso,
      updated_at = now()
    RETURNING * INTO v_new_record;

    v_results := array_append(v_results, to_jsonb(v_new_record));

    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
    VALUES (
      v_escola_id,
      v_actor_id,
      CASE WHEN v_old_record IS NULL THEN 'CREATE' ELSE 'UPDATE' END,
      'periodos_letivos',
      v_new_record.id::text,
      to_jsonb(v_old_record),
      to_jsonb(v_new_record),
      'admin'
    );
  END LOOP;

  RETURN jsonb_build_object('data', v_results);
EXCEPTION
  WHEN others THEN
    RAISE;
END;
$function$;
