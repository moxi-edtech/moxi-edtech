
-- CURTUME: year-scoped reconciliation of class-subject links.
-- Atomic, tenant-scoped, with an audit snapshot of each retired row.
DO $reconcile$
DECLARE
  v_school uuid := '3744879f-2e19-4671-8995-78604302d8c5'::uuid;
  v_bad_count integer;
  v_pair_count integer;
  v_teacher_count integer;
  v_eval_count integer;
  v_deleted_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:curtume:turma_disciplinas:2026', 0));

  CREATE TEMP TABLE _curtume_bad_td_2026 ON COMMIT DROP AS
  SELECT td.id AS bad_id, canonical.id AS canonical_id
  FROM public.turma_disciplinas td
  JOIN public.turmas t ON t.id = td.turma_id AND t.escola_id = v_school
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id AND cm.escola_id = v_school
  JOIN public.curso_curriculos cc ON cc.id = cm.curso_curriculo_id AND cc.escola_id = v_school
  JOIN public.curso_matriz cm_ok ON
    cm_ok.escola_id = v_school
    AND cm_ok.curso_id = cm.curso_id
    AND cm_ok.classe_id = cm.classe_id
    AND cm_ok.disciplina_id = cm.disciplina_id
  JOIN public.curso_curriculos cc_ok ON
    cc_ok.id = cm_ok.curso_curriculo_id
    AND cc_ok.escola_id = v_school
    AND cc_ok.ano_letivo_id = t.ano_letivo_id
  JOIN public.turma_disciplinas canonical ON
    canonical.escola_id = v_school
    AND canonical.turma_id = t.id
    AND canonical.curso_matriz_id = cm_ok.id
  WHERE td.escola_id = v_school
    AND t.ano_letivo = 2026
    AND cc.ano_letivo_id IS DISTINCT FROM t.ano_letivo_id;

  SELECT count(*) INTO v_bad_count
  FROM public.turma_disciplinas td
  JOIN public.turmas t ON t.id = td.turma_id
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  JOIN public.curso_curriculos cc ON cc.id = cm.curso_curriculo_id
  WHERE td.escola_id = v_school AND t.escola_id = v_school
    AND t.ano_letivo = 2026 AND cc.ano_letivo_id IS DISTINCT FROM t.ano_letivo_id;

  SELECT count(*) INTO v_pair_count FROM _curtume_bad_td_2026;

  IF v_bad_count NOT IN (0, 259) OR v_pair_count <> v_bad_count
    OR EXISTS (
      SELECT 1 FROM _curtume_bad_td_2026
      GROUP BY bad_id HAVING count(*) <> 1
    ) THEN
    RAISE EXCEPTION 'CURTUME_2026_RECONCILE_PRECONDITION_FAILED: bad=%, pairs=%',
      v_bad_count, v_pair_count;
  END IF;

  IF v_bad_count = 0 THEN RETURN; END IF;

  -- Avoid replacing an existing teacher or colliding with an already existing assessment.
  IF EXISTS (
    SELECT 1 FROM _curtume_bad_td_2026 p
    JOIN public.turma_disciplinas bad ON bad.id=p.bad_id
    JOIN public.turma_disciplinas canonical ON canonical.id=p.canonical_id
    WHERE bad.professor_id IS NOT NULL
      AND canonical.professor_id IS NOT NULL
      AND canonical.professor_id <> bad.professor_id
  ) THEN
    RAISE EXCEPTION 'CURTUME_2026_TEACHER_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _curtume_bad_td_2026 p
    JOIN public.avaliacoes a ON a.turma_disciplina_id=p.bad_id
    JOIN public.avaliacoes existing ON
      existing.turma_disciplina_id=p.canonical_id
      AND existing.escola_id=a.escola_id
      AND existing.ano_letivo=a.ano_letivo
      AND existing.trimestre=a.trimestre
      AND existing.tipo=a.tipo
  ) THEN
    RAISE EXCEPTION 'CURTUME_2026_ASSESSMENT_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.aulas a
    JOIN _curtume_bad_td_2026 p ON p.bad_id=a.turma_disciplina_id
  ) THEN
    RAISE EXCEPTION 'CURTUME_2026_CLASS_SESSION_DEPENDENCY';
  END IF;

  INSERT INTO public.audit_logs
    (escola_id, acao, tabela, registro_id, action, entity, entity_id,
     before, after, portal, details)
  SELECT
    v_school, 'CORRIGIR_MATRIZ_ANO_2026', 'turma_disciplinas', bad.id::text,
    'curriculum_year_reconciliation', 'turma_disciplinas', bad.id::text,
    to_jsonb(bad),
    jsonb_build_object('canonical_turma_disciplina_id',p.canonical_id),
    'manutencao_academica',
    jsonb_build_object('ano_letivo',2026,'motivo','matriz curricular de outro ano')
  FROM _curtume_bad_td_2026 p
  JOIN public.turma_disciplinas bad ON bad.id=p.bad_id;

  UPDATE public.turma_disciplinas canonical
  SET professor_id=bad.professor_id
  FROM _curtume_bad_td_2026 p
  JOIN public.turma_disciplinas bad ON bad.id=p.bad_id
  WHERE canonical.id=p.canonical_id AND canonical.escola_id=v_school
    AND bad.professor_id IS NOT NULL
    AND canonical.professor_id IS NULL;
  GET DIAGNOSTICS v_teacher_count = ROW_COUNT;

  UPDATE public.avaliacoes a
  SET turma_disciplina_id=p.canonical_id
  FROM _curtume_bad_td_2026 p
  WHERE a.turma_disciplina_id=p.bad_id AND a.escola_id=v_school;
  GET DIAGNOSTICS v_eval_count = ROW_COUNT;

  DELETE FROM public.turma_disciplinas bad
  USING _curtume_bad_td_2026 p
  WHERE bad.id=p.bad_id AND bad.escola_id=v_school;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> v_bad_count THEN
    RAISE EXCEPTION 'CURTUME_2026_DELETE_COUNT_MISMATCH: expected %, got %',
      v_bad_count, v_deleted_count;
  END IF;

  INSERT INTO public.audit_logs
    (escola_id, acao, tabela, registro_id, action, entity, entity_id, portal, details)
  VALUES
    (v_school, 'CORRIGIR_MATRIZ_ANO_2026', 'turma_disciplinas', '2026',
     'curriculum_year_reconciliation_complete', 'ano_letivo', '2026',
     'manutencao_academica',
     jsonb_build_object('removed_bad_links', v_deleted_count,
                        'reassociated_evaluations', v_eval_count,
                        'teachers_transferred', v_teacher_count,
                        'grades_deleted', 0));
END;
$reconcile$;

-- Reject new cross-year associations while allowing unrelated edits to legacy rows.
CREATE OR REPLACE FUNCTION public.enforce_turma_disciplina_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $guard$
DECLARE
  t_escola uuid;
  t_curso uuid;
  t_classe uuid;
  t_ano_id uuid;
  m_escola uuid;
  m_curso uuid;
  m_classe uuid;
  m_ano_id uuid;
  v_check_year boolean;
BEGIN
  SELECT t.escola_id, t.curso_id, t.classe_id, t.ano_letivo_id
    INTO t_escola, t_curso, t_classe, t_ano_id
  FROM public.turmas t WHERE t.id=NEW.turma_id;

  SELECT cm.escola_id, cm.curso_id, cm.classe_id, cc.ano_letivo_id
    INTO m_escola, m_curso, m_classe, m_ano_id
  FROM public.curso_matriz cm
  LEFT JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id
  WHERE cm.id=NEW.curso_matriz_id;

  IF t_escola IS NULL OR m_escola IS NULL THEN
    RAISE EXCEPTION 'FK inválida em turma_disciplinas (turma/matriz não encontrada)';
  END IF;

  IF NEW.escola_id <> t_escola OR t_escola <> m_escola THEN
    RAISE EXCEPTION 'Violação multi-tenant: escola_id inconsistente (turma_disciplinas)';
  END IF;

  IF t_curso <> m_curso OR t_classe <> m_classe THEN
    RAISE EXCEPTION 'Disciplina não pertence ao curso/classe da turma (turma_disciplinas)';
  END IF;

  IF TG_OP='INSERT' THEN
    v_check_year := true;
  ELSE
    v_check_year := NEW.turma_id IS DISTINCT FROM OLD.turma_id
      OR NEW.curso_matriz_id IS DISTINCT FROM OLD.curso_matriz_id
      OR NEW.escola_id IS DISTINCT FROM OLD.escola_id;
  END IF;

  IF v_check_year AND (t_ano_id IS NULL OR m_ano_id IS NULL OR t_ano_id <> m_ano_id) THEN
    RAISE EXCEPTION USING
      ERRCODE='23514',
      MESSAGE='Matriz curricular de ano letivo diferente da turma';
  END IF;

  RETURN NEW;
END;
$guard$;
