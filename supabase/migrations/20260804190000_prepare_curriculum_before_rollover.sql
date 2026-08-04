BEGIN;

CREATE OR REPLACE FUNCTION public.prepare_curricula_for_academic_year(
  p_escola_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_source record;
  v_target_id uuid;
  v_count integer := 0;
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id invalido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_financeiro','admin_secretaria','diretor']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissao negada';
  END IF;

  FOR v_source IN
    SELECT cc.*
    FROM public.curso_curriculos cc
    WHERE cc.escola_id = p_escola_id
      AND cc.ano_letivo_id = p_from_session_id
      AND cc.status = 'published'
  LOOP
    SELECT cc.id INTO v_target_id
    FROM public.curso_curriculos cc
    WHERE cc.escola_id = p_escola_id
      AND cc.curso_id = v_source.curso_id
      AND cc.ano_letivo_id = p_to_session_id
      AND cc.classe_id IS NOT DISTINCT FROM v_source.classe_id
      AND cc.status = 'published'
    ORDER BY cc.created_at DESC
    LIMIT 1;

    IF v_target_id IS NULL THEN
      INSERT INTO public.curso_curriculos (
        escola_id, curso_id, ano_letivo_id, version, status, classe_id, created_by
      ) VALUES (
        p_escola_id, v_source.curso_id, p_to_session_id, v_source.version, 'published', v_source.classe_id, v_actor_id
      ) RETURNING id INTO v_target_id;
      v_count := v_count + 1;
    END IF;

    INSERT INTO public.curso_matriz (
      escola_id, curso_id, classe_id, disciplina_id, carga_horaria,
      obrigatoria, ordem, ativo, curso_curriculo_id
    )
    SELECT cm.escola_id, cm.curso_id, cm.classe_id, cm.disciplina_id,
           cm.carga_horaria, cm.obrigatoria, cm.ordem, cm.ativo, v_target_id
    FROM public.curso_matriz cm
    WHERE cm.curso_curriculo_id = v_source.id
      AND NOT EXISTS (
        SELECT 1 FROM public.curso_matriz existing
        WHERE existing.curso_curriculo_id = v_target_id
          AND existing.disciplina_id = cm.disciplina_id
          AND existing.classe_id = cm.classe_id
      );
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
  VALUES (
    p_escola_id, v_actor_id, 'CURRICULOS_PREPARADOS_VIRADA', 'anos_letivos', p_to_session_id::text,
    jsonb_build_object('from_session_id', p_from_session_id, 'to_session_id', p_to_session_id, 'curriculos_criados', v_count, 'at', now()),
    'admin'
  );

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_academic_structure_v2(
  p_escola_id uuid,
  p_from_session_id uuid,
  p_to_session_id uuid,
  p_readjust_percent numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_curriculos integer;
  v_result jsonb;
BEGIN
  v_curriculos := public.prepare_curricula_for_academic_year(p_escola_id, p_from_session_id, p_to_session_id);
  v_result := public.clone_academic_structure_v1(p_escola_id, p_from_session_id, p_to_session_id, p_readjust_percent);
  RETURN jsonb_set(v_result, '{summary,curriculos}', to_jsonb(v_curriculos), true);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_curricula_for_academic_year(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clone_academic_structure_v2(uuid, uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_curricula_for_academic_year(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clone_academic_structure_v2(uuid, uuid, uuid, numeric) TO authenticated;

COMMIT;
