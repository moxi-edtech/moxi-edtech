BEGIN;

-- =========================================================
-- PASSO 1: CRIAR A FUNÇÃO RPC PARA UPSERT EM MASSA E AUDITADO
-- =========================================================

CREATE OR REPLACE FUNCTION public.upsert_bulk_periodos_letivos(
  p_escola_id uuid,
  p_periodos_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_periodo_data jsonb;
  v_old_record public.periodos_letivos;
  v_new_record public.periodos_letivos;
  v_results jsonb[] := '{}';
  v_actor_id uuid := auth.uid();
BEGIN

  -- Loop através de cada período no array JSON
  FOR v_periodo_data IN SELECT * FROM jsonb_array_elements(p_periodos_data) LOOP
    
    -- Busca o registro antigo para auditoria, se existir um ID
    IF v_periodo_data ? 'id' THEN
      SELECT * INTO v_old_record 
      FROM public.periodos_letivos 
      WHERE id = (v_periodo_data->>'id')::uuid AND escola_id = p_escola_id;
    ELSE
      v_old_record := NULL;
    END IF;

    -- Inserir ou atualizar o período letivo
    INSERT INTO public.periodos_letivos (
      id,
      escola_id,
      ano_letivo_id,
      tipo,
      numero,
      data_inicio,
      data_fim,
      trava_notas_em
    )
    VALUES (
      COALESCE((v_periodo_data->>'id')::uuid, gen_random_uuid()),
      p_escola_id,
      (v_periodo_data->>'ano_letivo_id')::uuid,
      (v_periodo_data->>'tipo')::periodo_tipo,
      (v_periodo_data->>'numero')::int,
      (v_periodo_data->>'data_inicio')::date,
      (v_periodo_data->>'data_fim')::date,
      (v_periodo_data->>'trava_notas_em')::timestamptz
    )
    ON CONFLICT (escola_id, ano_letivo_id, tipo, numero) DO UPDATE SET
      data_inicio = EXCLUDED.data_inicio,
      data_fim = EXCLUDED.data_fim,
      trava_notas_em = EXCLUDED.trava_notas_em,
      updated_at = now()
    RETURNING * INTO v_new_record;

    -- Adiciona o resultado ao array de resultados
    v_results := array_append(v_results, to_jsonb(v_new_record));

    -- =========================================================
    -- PASSO 2: INSERIR REGISTRO DE AUDITORIA PARA CADA ITEM
    -- =========================================================
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal)
    VALUES (
      p_escola_id,
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
$$;

ALTER FUNCTION public.upsert_bulk_periodos_letivos(uuid, jsonb) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.upsert_bulk_periodos_letivos(uuid, jsonb) TO authenticated;


COMMIT;
