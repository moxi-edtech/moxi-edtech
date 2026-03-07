DO $$
BEGIN
  EXECUTE $function$
CREATE OR REPLACE FUNCTION public.upsert_quadro_horarios_versao_atomic(
  p_escola_id uuid,
  p_turma_id uuid,
  p_versao_id uuid,
  p_items jsonb,
  p_publish boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $body$
DECLARE
  v_versao_id uuid;
  v_rows int := 0;
  v_published_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(CONCAT(p_escola_id::text, ':', p_turma_id::text, ':', p_versao_id::text)));

  SELECT id INTO v_versao_id
  FROM public.horario_versoes
  WHERE id = p_versao_id
    AND escola_id = p_escola_id
    AND turma_id = p_turma_id;

  IF v_versao_id IS NULL THEN
    RAISE EXCEPTION 'versao_id não pertence à escola/turma informada';
  END IF;

  DELETE FROM public.quadro_horarios
  WHERE escola_id = p_escola_id
    AND turma_id = p_turma_id
    AND versao_id = p_versao_id;

  INSERT INTO public.quadro_horarios (
    escola_id,
    turma_id,
    disciplina_id,
    professor_id,
    sala_id,
    slot_id,
    versao_id
  )
  SELECT
    p_escola_id,
    p_turma_id,
    (item->>'disciplina_id')::uuid,
    NULLIF(item->>'professor_id', '')::uuid,
    NULLIF(item->>'sala_id', '')::uuid,
    (item->>'slot_id')::uuid,
    p_versao_id
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS item;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF p_publish THEN
    v_published_id := public.publish_horario_versao(p_escola_id, p_turma_id, p_versao_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'versao_id', p_versao_id,
    'inserted', v_rows,
    'published_id', v_published_id
  );
END;
$body$;
$function$;

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_quadro_horarios_versao_atomic(uuid, uuid, uuid, jsonb, boolean) TO authenticated';
END
$$;
