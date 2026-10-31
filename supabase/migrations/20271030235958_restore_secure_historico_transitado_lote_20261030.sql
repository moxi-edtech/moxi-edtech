-- Issue #308: restore authenticated historical transcript batch RPC without changing RLS policies.
-- The previously queued batch_and_rls_hardening migration must be archived after this replacement.
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
SET search_path = ''
AS $fn$
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
  IF NOT coalesce(public.user_has_role_in_school(
    p_escola_id, ARRAY['secretaria','admin','admin_escola','staff_admin']::text[]
  ), false) THEN
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
$fn$;
REVOKE ALL ON FUNCTION public.upsert_historico_transitado_lote(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_historico_transitado_lote(uuid,uuid,uuid,integer,jsonb) TO authenticated;
