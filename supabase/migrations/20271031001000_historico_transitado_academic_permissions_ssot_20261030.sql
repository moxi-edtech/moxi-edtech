-- KLASSE #308 — historical transcript role matrix SSOT.
-- Existing product permissions deliberately allow composite admin_financeiro and
-- secretaria_financeiro academic roles. Pure financeiro never inherits them.
-- Fail if the eight original RLS policies have drifted.
DO $verify$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_policies
  WHERE schemaname='public'
    AND ((tablename='historico_transitado_anos'
          AND policyname IN ('historico_transitado_anos_select','historico_transitado_anos_insert','historico_transitado_anos_update','historico_transitado_anos_delete'))
      OR (tablename='historico_transitado_notas'
          AND policyname IN ('historico_transitado_notas_select','historico_transitado_notas_insert','historico_transitado_notas_update','historico_transitado_notas_delete')))
    AND roles::text LIKE '%authenticated%';
  IF n <> 8 THEN
    RAISE EXCEPTION 'Transcript RLS policy contract changed: expected 8, got %',n;
  END IF;
END $verify$;

-- Only this table's history capability changes; never widen is_staff_escola()
-- or the general user_has_role_in_school() mapping for other modules.
CREATE OR REPLACE FUNCTION public.can_manage_historico_transitado(p_escola_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $auth$
  SELECT p_escola_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND (
       public.check_super_admin_role()
       OR EXISTS (
         SELECT 1 FROM public.escola_users eu
         WHERE eu.escola_id = p_escola_id
           AND eu.user_id = auth.uid()
           AND eu.papel IN (
             'admin','admin_escola','staff_admin','secretaria',
             'admin_secretaria','admin_financeiro','secretaria_financeiro'
           )
       )
     );
$auth$;

REVOKE ALL ON FUNCTION public.can_manage_historico_transitado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_historico_transitado(uuid)
TO authenticated, service_role;

-- Keep original policy names, commands and authenticated-only scope.
-- ALTER POLICY preserves policy identity and does not DROP grants or records.
ALTER POLICY historico_transitado_anos_select
ON public.historico_transitado_anos
USING (public.can_manage_historico_transitado(escola_id));

ALTER POLICY historico_transitado_anos_insert
ON public.historico_transitado_anos
WITH CHECK (public.can_manage_historico_transitado(escola_id));

ALTER POLICY historico_transitado_anos_update
ON public.historico_transitado_anos
USING (public.can_manage_historico_transitado(escola_id))
WITH CHECK (public.can_manage_historico_transitado(escola_id));

ALTER POLICY historico_transitado_anos_delete
ON public.historico_transitado_anos
USING (public.can_manage_historico_transitado(escola_id));

ALTER POLICY historico_transitado_notas_select
ON public.historico_transitado_notas
USING (
  EXISTS (
    SELECT 1 FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

ALTER POLICY historico_transitado_notas_insert
ON public.historico_transitado_notas
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

ALTER POLICY historico_transitado_notas_update
ON public.historico_transitado_notas
USING (
  EXISTS (
    SELECT 1 FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

ALTER POLICY historico_transitado_notas_delete
ON public.historico_transitado_notas
USING (
  EXISTS (
    SELECT 1 FROM public.historico_transitado_anos hta
    WHERE hta.id = historico_transitado_notas.historico_transitado_ano_id
      AND public.can_manage_historico_transitado(hta.escola_id)
  )
);

-- Keep function bodies and transactional/audit behavior intact; replace only
-- their broader role expansion with the strict transcript capability.

CREATE OR REPLACE FUNCTION public.upsert_historico_transitado(p_escola_id uuid, p_aluno_id uuid, p_classe_id uuid, p_ano_letivo integer, p_notas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_escola_id uuid := public.current_tenant_escola_id();
  v_has_permission boolean;
  v_classe record;
  v_ano_record public.historico_transitado_anos%ROWTYPE;
  v_nota jsonb;
  v_disciplina_id uuid;
  v_disciplina_nome text;
  v_nota_final numeric(6,2);
  v_ordem integer;
  v_total_notas integer := 0;
BEGIN
  IF v_escola_id IS NULL OR v_escola_id IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;

  v_has_permission := public.can_manage_historico_transitado(v_escola_id);

  IF NOT COALESCE(v_has_permission, false) THEN
    RAISE EXCEPTION 'AUTH: Permissão negada.';
  END IF;

  IF p_ano_letivo < 1900 OR p_ano_letivo > 2100 THEN
    RAISE EXCEPTION 'DATA: ano letivo inválido.';
  END IF;

  IF jsonb_typeof(p_notas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_notas) = 0 THEN
    RAISE EXCEPTION 'DATA: pelo menos uma nota é obrigatória.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.alunos a
    WHERE a.id = p_aluno_id
      AND a.escola_id = v_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: aluno não encontrado para esta escola.';
  END IF;

  SELECT
    cl.id,
    cl.nome AS classe_nome,
    cl.curso_id,
    cu.nome AS curso_nome
  INTO v_classe
  FROM public.classes cl
  LEFT JOIN public.cursos cu
    ON cu.id = cl.curso_id
  WHERE cl.id = p_classe_id
    AND cl.escola_id = v_escola_id;

  IF v_classe.id IS NULL THEN
    RAISE EXCEPTION 'DATA: classe inválida para esta escola.';
  END IF;

  INSERT INTO public.historico_transitado_anos (
    escola_id,
    aluno_id,
    classe_id,
    classe_nome,
    curso_id,
    curso_nome,
    ano_letivo,
    created_by,
    updated_by
  )
  VALUES (
    v_escola_id,
    p_aluno_id,
    v_classe.id,
    v_classe.classe_nome,
    v_classe.curso_id,
    v_classe.curso_nome,
    p_ano_letivo,
    auth.uid(),
    auth.uid()
  )
  ON CONFLICT (escola_id, aluno_id, classe_id, ano_letivo) DO UPDATE
  SET classe_nome = EXCLUDED.classe_nome,
      curso_id = EXCLUDED.curso_id,
      curso_nome = EXCLUDED.curso_nome,
      updated_at = now(),
      updated_by = auth.uid()
  RETURNING * INTO v_ano_record;

  DELETE FROM public.historico_transitado_notas
  WHERE historico_transitado_ano_id = v_ano_record.id;

  FOR v_nota IN
    SELECT value
    FROM jsonb_array_elements(p_notas)
  LOOP
    v_disciplina_id := NULLIF(TRIM(v_nota->>'disciplina_id'), '')::uuid;
    v_disciplina_nome := NULLIF(TRIM(v_nota->>'disciplina_nome'), '');
    v_nota_final := NULLIF(TRIM(v_nota->>'nota_final'), '')::numeric;
    v_ordem := NULLIF(TRIM(v_nota->>'ordem'), '')::integer;

    IF v_disciplina_id IS NULL OR v_disciplina_nome IS NULL THEN
      RAISE EXCEPTION 'DATA: disciplina inválida no payload.';
    END IF;

    IF v_nota_final IS NULL OR v_nota_final < 0 OR v_nota_final > 20 THEN
      RAISE EXCEPTION 'DATA: nota final inválida para a disciplina %.', v_disciplina_nome;
    END IF;

    INSERT INTO public.historico_transitado_notas (
      historico_transitado_ano_id,
      disciplina_id,
      disciplina_nome,
      ordem,
      nota_final
    )
    VALUES (
      v_ano_record.id,
      v_disciplina_id,
      v_disciplina_nome,
      v_ordem,
      v_nota_final
    );

    v_total_notas := v_total_notas + 1;
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    v_escola_id,
    auth.uid(),
    'HISTORICO_TRANSITADO_UPSERT',
    'historico_transitado_anos',
    v_ano_record.id::text,
    'secretaria',
    jsonb_build_object(
      'aluno_id', p_aluno_id,
      'classe_id', v_classe.id,
      'classe_nome', v_classe.classe_nome,
      'ano_letivo', p_ano_letivo,
      'total_notas', v_total_notas
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'historico_transitado_ano_id', v_ano_record.id,
    'classe_nome', v_classe.classe_nome,
    'ano_letivo', p_ano_letivo,
    'total_notas', v_total_notas
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_historico_transitado_lote(p_escola_id uuid, p_turma_id uuid, p_classe_id uuid, p_ano_letivo integer, p_registos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_registo jsonb;
  v_aluno_id uuid;
  v_notas jsonb;
  v_processed integer := 0;
  v_total_notas integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH: autenticação necessária.';
  END IF;
  IF p_escola_id IS NULL OR p_escola_id IS DISTINCT FROM public.current_tenant_escola_id() THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido.';
  END IF;
  IF NOT public.can_manage_historico_transitado(p_escola_id) THEN
    RAISE EXCEPTION 'AUTH: permissão negada.';
  END IF;
  IF p_ano_letivo IS NULL OR p_ano_letivo < 1900 OR p_ano_letivo > 2100 THEN
    RAISE EXCEPTION 'DATA: ano letivo inválido.';
  END IF;
  IF jsonb_typeof(p_registos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'DATA: registos devem ser um array.';
  END IF;
  IF jsonb_array_length(p_registos) = 0 OR jsonb_array_length(p_registos) > 500 THEN
    RAISE EXCEPTION 'DATA: lote deve conter entre 1 e 500 alunos.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_registos) e
    WHERE jsonb_typeof(e.value) IS DISTINCT FROM 'object'
       OR jsonb_typeof(e.value->'notas') IS DISTINCT FROM 'array'
  ) THEN
    RAISE EXCEPTION 'DATA: estrutura dos registos inválida.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_registos) e
    GROUP BY NULLIF(btrim(e.value->>'aluno_id'), '')::uuid
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'DATA: alunos duplicados no lote.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = p_turma_id AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: turma não pertence à escola.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_classe_id AND c.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'DATA: classe histórica não pertence à escola.';
  END IF;

  -- Deterministic lock order prevents same-batch deadlocks.
  FOR v_registo IN
    SELECT e.value
      FROM jsonb_array_elements(p_registos) e
     ORDER BY e.value->>'aluno_id'
  LOOP
    v_aluno_id := NULLIF(btrim(v_registo->>'aluno_id'), '')::uuid;
    v_notas := v_registo->'notas';
    IF v_aluno_id IS NULL THEN
      RAISE EXCEPTION 'DATA: aluno_id obrigatório.';
    END IF;
    IF jsonb_array_length(v_notas) = 0 THEN
      RAISE EXCEPTION 'DATA: notas obrigatórias para cada aluno.';
    END IF;

    PERFORM 1 FROM public.matriculas m
     WHERE m.escola_id = p_escola_id
       AND m.turma_id = p_turma_id
       AND m.aluno_id = v_aluno_id
       AND m.status = 'ativo'
       AND m.ativo IS TRUE
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'DATA: aluno sem matrícula ativa na turma selecionada.';
    END IF;
    PERFORM public.upsert_historico_transitado(
      p_escola_id, v_aluno_id, p_classe_id, p_ano_letivo, v_notas
    );
    v_processed := v_processed + 1;
    v_total_notas := v_total_notas + jsonb_array_length(v_notas);
  END LOOP;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id, auth.uid(), 'HISTORICO_TRANSITADO_LOTE_UPSERT', 'turmas',
    p_turma_id::text, 'secretaria',
    jsonb_build_object('turma_id',p_turma_id,'classe_id',p_classe_id,
      'ano_letivo',p_ano_letivo,'total_alunos',v_processed,'total_notas',v_total_notas)
  );
  RETURN jsonb_build_object('ok',true,'turma_id',p_turma_id,
    'classe_id',p_classe_id,'ano_letivo',p_ano_letivo,
    'total_alunos',v_processed,'total_notas',v_total_notas);
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_historico_transitado(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado(uuid,uuid,uuid,integer,jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_historico_transitado_lote(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado_lote(uuid,uuid,uuid,integer,jsonb) TO authenticated, service_role;
