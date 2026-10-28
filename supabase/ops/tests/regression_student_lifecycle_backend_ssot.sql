-- KLASSE SSOT: regressão não destrutiva, executável no Supabase autenticado
-- por um operador de manutenção (postgres). Não cria nem altera alunos.
DO $lifecycle_regression$
BEGIN
  IF EXISTS (SELECT 1 FROM public.matriculas
             WHERE ativo IS DISTINCT FROM (status = 'ativo')) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: matriculas.status and ativo diverge';
  END IF;
  IF EXISTS (SELECT 1 FROM public.historico_anos WHERE matricula_id IS NULL) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: annual history missing enrollment link';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.matriculas'::regclass
      AND conname='chk_lifecycle_status_ativo_consistente' AND convalidated
  ) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: status/active DB constraint absent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.historico_anos'::regclass
      AND conname='chk_lifecycle_historico_com_matricula' AND convalidated
  ) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: annual history FK origin check not valid';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid='public.v_student_lifecycle_ssot_v1'::regclass
      AND 'security_invoker=true'=ANY(coalesce(reloptions, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: view bypasses invoker security';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.v_student_lifecycle_ssot_v1 v
    WHERE v.resultado_oficial IS NOT NULL AND
      (v.snapshot_status IS DISTINCT FROM 'fechado'
       OR NOT EXISTS (
         SELECT 1 FROM public.historico_snapshot_locks h
         WHERE h.matricula_id=v.matricula_id AND h.historico_ano_id=v.historico_id
           AND h.escola_id=v.escola_id AND h.status='fechado'
       ))
  ) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: official result without legal history lock';
  END IF;
  IF has_function_privilege('authenticated',
    'public.confirmar_matricula(uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated',
    'public.confirmar_matricula_core(uuid,integer,uuid,uuid)', 'EXECUTE')
    OR has_function_privilege('authenticated',
    'public.finalizar_matricula_anual(uuid,uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: legacy writer accessible to JWT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid='public.finalizar_matricula_blindada(uuid,uuid,text,boolean,text)'::regprocedure
      AND position('ativo = false' in pg_get_functiondef(oid)) > 0
      AND position('v_grade->>''situacao_final''' in pg_get_functiondef(oid)) > 0
  ) THEN
    RAISE EXCEPTION 'LIFECYCLE_REGRESSION: GradeEngine finalization contract regressed';
  END IF;
END;
$lifecycle_regression$;
