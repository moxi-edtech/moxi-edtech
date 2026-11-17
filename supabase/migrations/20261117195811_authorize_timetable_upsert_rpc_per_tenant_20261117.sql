-- Harden the timetable write RPC which runs SECURITY DEFINER.
-- The API authorization is not a substitute for a DB-level tenant + role check.
CREATE OR REPLACE FUNCTION public.upsert_quadro_horarios_versao_atomic(p_escola_id uuid, p_turma_id uuid, p_versao_id uuid, p_items jsonb, p_publish boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_versao_id uuid;
  v_rows int := 0;
  v_published_id uuid;
BEGIN
  -- SECURITY DEFINER bypasses RLS. Authorize the exact caller and tenant
  -- inside the RPC rather than relying exclusively on the Next.js route.
  IF COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    AND (
      (SELECT auth.uid()) IS NULL
      OR NOT (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.role IN ('super_admin', 'global_admin', 'admin')
        )
        OR EXISTS (
          SELECT 1 FROM public.escola_users eu
          WHERE eu.escola_id = p_escola_id
            AND eu.user_id = (SELECT auth.uid())
            AND LOWER(TRIM(COALESCE(eu.papel, eu.role))) IN
              ('admin_financeiro', 'admin_secretaria', 'admin_escola', 'diretor')
        )
      )
    )
  THEN
    RAISE EXCEPTION 'HORARIO_UPSERT_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

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

  PERFORM public.log_horario_event(
    p_escola_id,
    p_turma_id,
    p_versao_id,
    'DRAFT_SAVE',
    jsonb_build_object(
      'items', v_rows,
      'payload_hash', md5(COALESCE(p_items, '[]'::jsonb)::text),
      'publish', p_publish
    )
  );

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
$function$
;