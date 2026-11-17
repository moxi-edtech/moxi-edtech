-- Curriculum teacher allocation and timetable publication are independent.
-- Timetable: scheduling a same-tenant professor is permitted without an academic allocation.
-- Academic allocation/swap: never blocked by, or rewrites, timetable slots.
-- Preserve independent tenant/course validations, workload, ownership and conflict guards
-- on the timetable itself.
DROP TRIGGER IF EXISTS trg_validate_quadro_docente_alocacao ON public.quadro_horarios;
DROP FUNCTION IF EXISTS public.trg_validate_quadro_docente_alocacao();

CREATE OR REPLACE FUNCTION public.assign_professor_turma_disciplina_atomic(p_escola_id uuid, p_turma_id uuid, p_curso_matriz_id uuid, p_professor_id uuid, p_horarios jsonb DEFAULT NULL::jsonb, p_planejamento jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(mode text, disciplina_id uuid, professor_profile_id uuid, carga_atual integer, carga_maxima integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_disciplina_id uuid;
  v_prof_profile_id uuid;
  v_teacher_id uuid;
  v_carga_maxima integer;
  v_carga_atual integer;
  v_carga_nova integer;
  v_ano_id uuid;
  v_owner uuid;
  v_shared_owner uuid;
  v_exists boolean;
  v_rows integer;
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL
     OR p_curso_matriz_id IS NULL OR p_professor_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_INVALID_INPUT';
  END IF;

  -- Protect direct RPC callers as well as the Next.js API.
  IF COALESCE(pg_catalog.current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND ((SELECT auth.uid()) IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.escola_users eu
       WHERE eu.escola_id = p_escola_id AND eu.user_id = (SELECT auth.uid())
         AND COALESCE(eu.papel, eu.role) IN ('admin', 'admin_escola', 'admin_secretaria', 'admin_secretario', 'admin_financeiro', 'diretor', 'staff_admin', 'secretaria', 'secretaria_financeiro')
     )) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_FORBIDDEN';
  END IF;

  SELECT a.id INTO v_ano_id
  FROM public.anos_letivos a
  WHERE a.escola_id = p_escola_id AND a.ativo = true
  ORDER BY a.data_inicio DESC NULLS LAST, a.ano DESC, a.id
  LIMIT 1;
  IF v_ano_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ANO_INATIVO';
  END IF;

  -- Use the exact same lock as the batch RPC, BEFORE reading workload.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('klasse:teacher-assign:' || p_escola_id::text, 0)
  );

  -- Verify the actual offering in the active academic year. No draft or
  -- archived matrices, and never use a matrix of another class/course.
  SELECT cm.disciplina_id,
         COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0),
         td.professor_id
    INTO v_disciplina_id, v_carga_nova, v_owner
  FROM public.turma_disciplinas td
  JOIN public.turmas tu
    ON tu.id = td.turma_id AND tu.escola_id = td.escola_id
  JOIN public.curso_matriz cm
    ON cm.id = td.curso_matriz_id AND cm.escola_id = td.escola_id
   AND cm.curso_id = tu.curso_id AND cm.classe_id = tu.classe_id
   AND cm.ativo = true
  JOIN public.curso_curriculos cc
    ON cc.id = cm.curso_curriculo_id AND cc.escola_id = td.escola_id
   AND cc.ano_letivo_id = v_ano_id AND cc.status = 'published'
  WHERE td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id
    AND td.curso_matriz_id = p_curso_matriz_id
    AND tu.session_id = v_ano_id
  FOR UPDATE OF td;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSIGN_PROF_MATRIZ_ANO_INCOMPATIVEL';
  END IF;

  SELECT pr.profile_id, t.id, t.carga_horaria_maxima
    INTO v_prof_profile_id, v_teacher_id, v_carga_maxima
  FROM public.professores pr
  JOIN public.teachers t
    ON t.escola_id = pr.escola_id AND t.profile_id = pr.profile_id
  WHERE pr.id = p_professor_id AND pr.escola_id = p_escola_id
  LIMIT 1;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_PROFESSOR_NOT_FOUND';
  END IF;

  -- Refuse an existing owner from ANY matrix version for the same
  -- turma + subject; never rewrite another teacher's link.
  IF EXISTS (
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
    WHERE td.escola_id = p_escola_id AND td.turma_id = p_turma_id
      AND cm.escola_id = p_escola_id AND cm.disciplina_id = v_disciplina_id
      AND td.professor_id IS NOT NULL AND td.professor_id <> p_professor_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ALREADY_ASSIGNED';
  END IF;

  v_shared_owner := NULL;
  SELECT tdp.professor_id INTO v_shared_owner
  FROM public.turma_disciplinas_professores tdp
  WHERE tdp.escola_id = p_escola_id
    AND tdp.turma_id = p_turma_id AND tdp.disciplina_id = v_disciplina_id
  FOR UPDATE;

  IF (v_owner IS NOT NULL AND v_owner <> p_professor_id)
     OR (v_shared_owner IS NOT NULL AND v_shared_owner <> p_professor_id) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ALREADY_ASSIGNED';
  END IF;
  v_exists := v_owner = p_professor_id OR v_shared_owner = p_professor_id;

  -- Count weekly timetable periods ONLY in the active academic year,
  -- deduplicated by turma + subject across canonical and shared links.
  WITH per_subject AS (
    SELECT td.turma_id, cm.disciplina_id,
      MAX(COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0)) AS tempos
    FROM public.turma_disciplinas td
    JOIN public.turmas tu ON tu.id = td.turma_id AND tu.escola_id = td.escola_id
    JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id AND cm.escola_id = td.escola_id
     AND cm.curso_id = tu.curso_id AND cm.classe_id = tu.classe_id AND cm.ativo = true
    JOIN public.curso_curriculos cc
      ON cc.id = cm.curso_curriculo_id AND cc.escola_id = td.escola_id
     AND cc.ano_letivo_id = v_ano_id AND cc.status = 'published'
    WHERE td.escola_id = p_escola_id AND tu.session_id = v_ano_id
      AND (td.professor_id = p_professor_id OR EXISTS (
        SELECT 1 FROM public.turma_disciplinas_professores tdp
        WHERE tdp.escola_id = p_escola_id AND tdp.turma_id = td.turma_id
          AND tdp.disciplina_id = cm.disciplina_id
          AND tdp.professor_id = p_professor_id
      ))
    GROUP BY td.turma_id, cm.disciplina_id
  )
  SELECT COALESCE(SUM(tempos), 0)::integer INTO v_carga_atual
  FROM per_subject;

  IF NOT COALESCE(v_exists, false)
     AND COALESCE(v_carga_maxima, 0) > 0
     AND v_carga_atual + v_carga_nova > v_carga_maxima THEN
    RAISE EXCEPTION 'ASSIGN_PROF_CARGA_EXCEEDED';
  END IF;

  INSERT INTO public.turma_disciplinas_professores (
    escola_id, turma_id, disciplina_id, professor_id, horarios, planejamento
  ) VALUES (
    p_escola_id, p_turma_id, v_disciplina_id, p_professor_id,
    p_horarios, p_planejamento
  )
  ON CONFLICT ON CONSTRAINT uq_tdp_unique_escola
  DO UPDATE SET
    horarios = COALESCE(EXCLUDED.horarios, public.turma_disciplinas_professores.horarios),
    planejamento = COALESCE(EXCLUDED.planejamento, public.turma_disciplinas_professores.planejamento),
    updated_at = pg_catalog.now()
  WHERE public.turma_disciplinas_professores.professor_id = EXCLUDED.professor_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ALREADY_ASSIGNED';
  END IF;

  UPDATE public.turma_disciplinas
  SET professor_id = p_professor_id
  WHERE escola_id = p_escola_id AND turma_id = p_turma_id
    AND curso_matriz_id = p_curso_matriz_id
    AND (professor_id IS NULL OR professor_id = p_professor_id);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ALREADY_ASSIGNED';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN v_exists THEN 'updated' ELSE 'created' END::text,
    v_disciplina_id, v_prof_profile_id, v_carga_atual, v_carga_maxima;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trocar_professor_turma_disciplina_atomic(p_escola_id uuid, p_turma_id uuid, p_curso_matriz_id uuid, p_professor_anterior_id uuid, p_professor_novo_id uuid)
 RETURNS TABLE(professor_novo_profile_id uuid, disciplina_id uuid, carga_atual integer, carga_maxima integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ano_id uuid;
  v_disciplina_id uuid;
  v_owner uuid;
  v_shared_owner uuid;
  v_prof_profile_id uuid;
  v_carga_maxima integer;
  v_carga_atual integer;
  v_carga_nova integer;
  v_updated integer;
  v_quadro_count integer := 0;
  v_actor uuid := (SELECT auth.uid());
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_curso_matriz_id IS NULL
     OR p_professor_anterior_id IS NULL OR p_professor_novo_id IS NULL
     OR p_professor_anterior_id = p_professor_novo_id
  THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_INVALID_INPUT';
  END IF;

  -- SECURITY DEFINER must authorize every direct RPC caller against school membership.
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = v_actor
      AND COALESCE(eu.papel, eu.role) IN
        ('admin', 'admin_escola', 'admin_secretaria', 'admin_secretario',
         'admin_financeiro', 'diretor', 'staff_admin', 'secretaria', 'secretaria_financeiro')
  ) THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_FORBIDDEN';
  END IF;

  -- Serialize with BOTH existing single and batch assignment RPCs.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('klasse:teacher-assign:' || p_escola_id::text, 0)
  );

  SELECT ano.id INTO v_ano_id
  FROM public.anos_letivos ano
  WHERE ano.escola_id = p_escola_id AND ano.ativo = true
  ORDER BY ano.data_inicio DESC NULLS LAST, ano.ano DESC, ano.id
  LIMIT 1;
  IF v_ano_id IS NULL THEN RAISE EXCEPTION 'TEACHER_REPLACE_YEAR_NOT_ACTIVE'; END IF;

  -- Exact published current-year offering; never edit an archived year or draft.
  SELECT cm.disciplina_id,
         td.professor_id,
         COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0)
  INTO v_disciplina_id, v_owner, v_carga_nova
  FROM public.turma_disciplinas td
  JOIN public.turmas tu ON tu.id = td.turma_id AND tu.escola_id = p_escola_id
  JOIN public.curso_matriz cm
    ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
   AND cm.curso_id = tu.curso_id AND cm.classe_id = tu.classe_id AND cm.ativo = true
  JOIN public.curso_curriculos cc
    ON cc.id = cm.curso_curriculo_id AND cc.escola_id = p_escola_id
   AND cc.ano_letivo_id = v_ano_id AND cc.status = 'published'
  WHERE td.escola_id = p_escola_id AND td.turma_id = p_turma_id
    AND tu.session_id = v_ano_id AND td.curso_matriz_id = p_curso_matriz_id
  FOR UPDATE OF td;

  IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_REPLACE_OFFERING_NOT_PUBLISHED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professores p
    WHERE p.id = p_professor_anterior_id AND p.escola_id = p_escola_id
  ) THEN RAISE EXCEPTION 'TEACHER_REPLACE_PREVIOUS_MISMATCH'; END IF;

  SELECT p.profile_id, t.carga_horaria_maxima
  INTO v_prof_profile_id, v_carga_maxima
  FROM public.professores p
  JOIN public.teachers t ON t.escola_id = p.escola_id AND t.profile_id = p.profile_id
  WHERE p.id = p_professor_novo_id AND p.escola_id = p_escola_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_REPLACE_NEW_TEACHER_NOT_FOUND'; END IF;

  SELECT tdp.professor_id INTO v_shared_owner
  FROM public.turma_disciplinas_professores tdp
  WHERE tdp.escola_id = p_escola_id AND tdp.turma_id = p_turma_id
    AND tdp.disciplina_id = v_disciplina_id
  FOR UPDATE;

  -- CAS: the previous professor must still own the exact subject at commit time.
  IF (v_owner IS DISTINCT FROM p_professor_anterior_id
      AND v_shared_owner IS DISTINCT FROM p_professor_anterior_id)
     OR (v_owner IS NOT NULL AND v_owner <> p_professor_anterior_id)
     OR (v_shared_owner IS NOT NULL AND v_shared_owner <> p_professor_anterior_id)
  THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_PREVIOUS_MISMATCH';
  END IF;

  -- Another curricular version or an old timetable link with a THIRD owner
  -- is ambiguous. Never silently flatten inconsistent historical data.
  IF EXISTS (
    SELECT 1
    FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
    WHERE td.escola_id = p_escola_id AND td.turma_id = p_turma_id
      AND cm.disciplina_id = v_disciplina_id
      AND td.professor_id IS NOT NULL AND td.professor_id <> p_professor_anterior_id
  ) OR EXISTS (
    -- Multiple published offerings for the SAME turma/subject would make
    -- historical teacher attribution ambiguous. Require data reconciliation
    -- rather than rewrite another published curricular version.
    SELECT 1 FROM public.turma_disciplinas td
    JOIN public.curso_matriz cm
      ON cm.id=td.curso_matriz_id AND cm.escola_id=p_escola_id
    JOIN public.curso_curriculos cc
      ON cc.id=cm.curso_curriculo_id AND cc.escola_id=p_escola_id
     AND cc.ano_letivo_id=v_ano_id AND cc.status='published'
    WHERE td.escola_id=p_escola_id AND td.turma_id=p_turma_id
      AND cm.disciplina_id=v_disciplina_id
      AND td.curso_matriz_id<>p_curso_matriz_id
  ) THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_CONFLICTING_LINKS';
  END IF;

  -- The incoming teacher's weekly load, counting only published current-year
  -- turma/subject pairs and excluding the target being replaced.
  WITH subject_load AS (
    SELECT td.turma_id, cm.disciplina_id,
      MAX(COALESCE(td.carga_horaria_semanal, cm.carga_horaria_semanal, 0)) AS tempos
    FROM public.turma_disciplinas td
    JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=p_escola_id
    JOIN public.curso_matriz cm
      ON cm.id=td.curso_matriz_id AND cm.escola_id=p_escola_id
     AND cm.curso_id=tu.curso_id AND cm.classe_id=tu.classe_id AND cm.ativo=true
    JOIN public.curso_curriculos cc
      ON cc.id=cm.curso_curriculo_id AND cc.escola_id=p_escola_id
     AND cc.ano_letivo_id=v_ano_id AND cc.status='published'
    WHERE td.escola_id=p_escola_id AND tu.session_id=v_ano_id
      AND (td.turma_id <> p_turma_id OR cm.disciplina_id <> v_disciplina_id)
      AND (td.professor_id=p_professor_novo_id OR EXISTS (
        SELECT 1 FROM public.turma_disciplinas_professores tdp
        WHERE tdp.escola_id=p_escola_id AND tdp.turma_id=td.turma_id
          AND tdp.disciplina_id=cm.disciplina_id AND tdp.professor_id=p_professor_novo_id
      ))
    GROUP BY td.turma_id,cm.disciplina_id
  )
  SELECT COALESCE(SUM(tempos),0)::integer INTO v_carga_atual FROM subject_load;

  IF COALESCE(v_carga_maxima,0)>0
    AND v_carga_atual + v_carga_nova > v_carga_maxima THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_WORKLOAD_EXCEEDED';
  END IF;

  -- Update the canonical and shared live links without deleting rows:
  -- keep IDs, syllabus, planning, grade and attendance references untouched.
  -- Change only the current published offering, never archived/draft versions.
  UPDATE public.turma_disciplinas td SET professor_id=p_professor_novo_id
  WHERE td.escola_id=p_escola_id AND td.turma_id=p_turma_id
    AND td.curso_matriz_id=p_curso_matriz_id
    AND (td.professor_id=p_professor_anterior_id OR td.professor_id IS NULL);

  UPDATE public.turma_disciplinas_professores tdp
  SET professor_id=p_professor_novo_id, updated_at=pg_catalog.now()
  WHERE tdp.escola_id=p_escola_id AND tdp.turma_id=p_turma_id
    AND tdp.disciplina_id=v_disciplina_id AND tdp.professor_id=p_professor_anterior_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    INSERT INTO public.turma_disciplinas_professores
      (escola_id,turma_id,disciplina_id,professor_id)
    VALUES (p_escola_id,p_turma_id,v_disciplina_id,p_professor_novo_id);
  END IF;

  -- One audit entry in the SAME transaction. Failure of the audit aborts the swap.
  INSERT INTO public.audit_logs (
    escola_id,user_id,actor_id,acao,tabela,registro_id,portal,details,before,after
  ) VALUES (
    p_escola_id,v_actor,v_actor,'PROFESSOR_ATRIBUICAO_TROCA',
    'turma_disciplinas',p_turma_id::text,'secretaria',
    pg_catalog.jsonb_build_object(
      'turma_id',p_turma_id,'curso_matriz_id',p_curso_matriz_id,
      'disciplina_id',v_disciplina_id,'quadro_horarios_atualizados',v_quadro_count,
      'ano_letivo_id',v_ano_id
    ),
    pg_catalog.jsonb_build_object('professor_id',p_professor_anterior_id),
    pg_catalog.jsonb_build_object('professor_id',p_professor_novo_id)
  );
  RETURN QUERY SELECT v_prof_profile_id,v_disciplina_id,
    (v_carga_atual+v_carga_nova)::integer,v_carga_maxima;
END
$function$
;
COMMENT ON COLUMN public.quadro_horarios.professor_id IS
  'Optional professor chosen for this scheduled lesson; independent of academic turma-disciplina allocations.';
