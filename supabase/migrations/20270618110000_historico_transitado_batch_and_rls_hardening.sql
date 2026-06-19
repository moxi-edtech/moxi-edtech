BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_historico_transitado(p_escola_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_escola_id IS NULL THEN
    RETURN false;
  END IF;

  IF p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RETURN false;
  END IF;

  RETURN public.user_has_role_in_school(
    p_escola_id,
    ARRAY['secretaria', 'admin']
  );
END;
$$;

DROP POLICY IF EXISTS historico_transitado_anos_select ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_select
ON public.historico_transitado_anos
FOR SELECT
TO authenticated
USING (public.can_manage_historico_transitado(escola_id));

DROP POLICY IF EXISTS historico_transitado_anos_insert ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_insert
ON public.historico_transitado_anos
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_historico_transitado(escola_id));

DROP POLICY IF EXISTS historico_transitado_anos_update ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_update
ON public.historico_transitado_anos
FOR UPDATE
TO authenticated
USING (public.can_manage_historico_transitado(escola_id))
WITH CHECK (public.can_manage_historico_transitado(escola_id));

DROP POLICY IF EXISTS historico_transitado_anos_delete ON public.historico_transitado_anos;
CREATE POLICY historico_transitado_anos_delete
ON public.historico_transitado_anos
FOR DELETE
TO authenticated
USING (public.can_manage_historico_transitado(escola_id));

DROP POLICY IF EXISTS historico_transitado_notas_select ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_select
ON public.historico_transitado_notas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_insert ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_insert
ON public.historico_transitado_notas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_update ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_update
ON public.historico_transitado_notas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

DROP POLICY IF EXISTS historico_transitado_notas_delete ON public.historico_transitado_notas;
CREATE POLICY historico_transitado_notas_delete
ON public.historico_transitado_notas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

CREATE OR REPLACE FUNCTION public.upsert_historico_transitado_lote(
  p_escola_id uuid,
  p_turma_id uuid,
  p_classe_id uuid,
  p_ano_letivo integer,
  p_registos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_registo jsonb;
  v_aluno_id uuid;
  v_notas jsonb;
  v_processed_students integer := 0;
  v_total_notas integer := 0;
BEGIN
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  SELECT public.user_has_role_in_school(
    v_escola_id,
    ARRAY['secretaria', 'admin']
  )
  INTO v_has_permission;

  IF NOT COALESCE(v_has_permission, false) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_ano_letivo < 1900 OR p_ano_letivo > 2100 THEN
    RAISE EXCEPTION 'DATA: ano letivo inválido.';
  END IF;

  IF jsonb_typeof(p_registos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_registos) = 0 THEN
    RAISE EXCEPTION 'DATA: pelo menos um aluno é obrigatório.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = v_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: turma inválida para esta escola.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = p_classe_id
      AND c.escola_id = v_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: classe inválida para esta escola.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_registos) AS reg(aluno_id text, notas jsonb)
    GROUP BY reg.aluno_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'DATA: payload contém alunos duplicados.';
  END IF;

  FOR v_registo IN
    SELECT value
    FROM jsonb_array_elements(p_registos)
  LOOP
    v_aluno_id := NULLIF(TRIM(v_registo->>'aluno_id'), '')::uuid;
    v_notas := v_registo->'notas';

    IF v_aluno_id IS NULL THEN
      RAISE EXCEPTION 'DATA: aluno inválido no payload.';
    END IF;

    IF jsonb_typeof(v_notas) IS DISTINCT FROM 'array' OR jsonb_array_length(v_notas) = 0 THEN
      RAISE EXCEPTION 'DATA: o aluno % não possui notas para migrar.', v_aluno_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.matriculas m
      WHERE m.escola_id = v_escola_id
        AND m.turma_id = p_turma_id
        AND m.aluno_id = v_aluno_id
    ) THEN
      RAISE EXCEPTION 'DATA: o aluno % não pertence à turma seleccionada.', v_aluno_id;
    END IF;

    PERFORM public.upsert_historico_transitado(
      v_escola_id,
      v_aluno_id,
      p_classe_id,
      p_ano_letivo,
      v_notas
    );

    v_processed_students := v_processed_students + 1;
    v_total_notas := v_total_notas + jsonb_array_length(v_notas);
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    auth.uid(),
    'HISTORICO_TRANSITADO_LOTE_UPSERT',
    'turmas',
    p_turma_id::text,
    'secretaria',
    jsonb_build_object(
      'turma_id', p_turma_id,
      'classe_id', p_classe_id,
      'ano_letivo', p_ano_letivo,
      'total_alunos', v_processed_students,
      'total_notas', v_total_notas
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'turma_id', p_turma_id,
    'classe_id', p_classe_id,
    'ano_letivo', p_ano_letivo,
    'total_alunos', v_processed_students,
    'total_notas', v_total_notas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_historico_transitado(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado_lote(uuid, uuid, uuid, integer, jsonb) TO authenticated;

COMMIT;
