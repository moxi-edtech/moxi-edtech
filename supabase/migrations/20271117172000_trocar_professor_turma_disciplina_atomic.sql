-- Explicit, compare-and-swap replacement of the professor for one turma/subject.
-- Never replace in a batch. Preserve grade/attendance records, syllabus and link IDs.
BEGIN;

CREATE OR REPLACE FUNCTION public.trocar_professor_turma_disciplina_atomic(
  p_escola_id uuid,
  p_turma_id uuid,
  p_curso_matriz_id uuid,
  p_professor_anterior_id uuid,
  p_professor_novo_id uuid
)
RETURNS TABLE(
  professor_novo_profile_id uuid,
  disciplina_id uuid,
  carga_atual integer,
  carga_maxima integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  v_quadro_count integer;
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
  ) OR EXISTS (
    SELECT 1 FROM public.quadro_horarios q
    JOIN public.horario_versoes hv
      ON hv.id = q.versao_id AND hv.escola_id = p_escola_id
     AND hv.status = 'publicada'
    WHERE q.escola_id = p_escola_id AND q.turma_id = p_turma_id
      AND q.disciplina_id = v_disciplina_id
      AND q.professor_id IS NOT NULL AND q.professor_id <> p_professor_anterior_id
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

  -- Check overlapping published slots even when the two turmas use different
  -- timetable version IDs or different slot IDs representing overlapping times.
  IF EXISTS (
    SELECT 1
    FROM public.quadro_horarios target
    JOIN public.horario_versoes tv
      ON tv.id=target.versao_id AND tv.escola_id=p_escola_id AND tv.status='publicada'
    JOIN public.horario_slots ts
      ON ts.id=target.slot_id AND ts.escola_id=p_escola_id
    JOIN public.quadro_horarios occupied
      ON occupied.escola_id=p_escola_id AND occupied.professor_id=p_professor_novo_id
     AND (occupied.turma_id <> p_turma_id OR occupied.disciplina_id <> v_disciplina_id)
    JOIN public.turmas other_turma
      ON other_turma.id=occupied.turma_id AND other_turma.escola_id=p_escola_id
     AND other_turma.session_id=v_ano_id
    JOIN public.horario_versoes ov
      ON ov.id=occupied.versao_id AND ov.escola_id=p_escola_id AND ov.status='publicada'
    JOIN public.horario_slots os
      ON os.id=occupied.slot_id AND os.escola_id=p_escola_id
     AND os.dia_semana=ts.dia_semana AND os.inicio<ts.fim AND ts.inicio<os.fim
    WHERE target.escola_id=p_escola_id AND target.turma_id=p_turma_id
      AND target.disciplina_id=v_disciplina_id
      AND COALESCE(ts.is_intervalo,false)=false AND COALESCE(os.is_intervalo,false)=false
  ) THEN RAISE EXCEPTION 'TEACHER_REPLACE_SCHEDULE_CONFLICT'; END IF;

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

  -- Published timetable entries must point to the new teacher. Keep draft
  -- timetable versions unchanged; they are not an active teaching assignment.
  UPDATE public.quadro_horarios qh
  SET professor_id=p_professor_novo_id
  FROM public.horario_versoes hv
  WHERE hv.id=qh.versao_id AND hv.escola_id=p_escola_id AND hv.status='publicada'
    AND qh.escola_id=p_escola_id AND qh.turma_id=p_turma_id
    AND qh.disciplina_id=v_disciplina_id
    AND (qh.professor_id=p_professor_anterior_id OR qh.professor_id IS NULL);
  GET DIAGNOSTICS v_quadro_count = ROW_COUNT;

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
$function$;

REVOKE ALL ON FUNCTION public.trocar_professor_turma_disciplina_atomic(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.trocar_professor_turma_disciplina_atomic(uuid,uuid,uuid,uuid,uuid) TO authenticated;
COMMIT;
