-- CANDIDATE ONLY: generate migration with CLI and validate on full schema before promotion.
-- Preserve every legacy value: NULL minute limit means the existing weekly periods contract.
ALTER TABLE public.teachers ADD COLUMN carga_contratual_minutos integer CHECK (carga_contratual_minutos > 0),
  ADD COLUMN carga_lectiva_limite_minutos integer CHECK (carga_lectiva_limite_minutos > 0),
  ADD CONSTRAINT teachers_lectiva_contratual_check CHECK (
    carga_contratual_minutos IS NULL OR carga_lectiva_limite_minutos IS NULL OR
    carga_lectiva_limite_minutos <= carga_contratual_minutos);
ALTER TABLE public.professores ADD CONSTRAINT professores_escola_id_id_docencia_key UNIQUE(escola_id,id);
ALTER TABLE public.turmas ADD COLUMN regime_docencia text NOT NULL DEFAULT 'pluridocencia'
    CHECK (regime_docencia IN ('monodocencia','pluridocencia','misto')),
  ADD COLUMN professor_titular_id uuid,
  ADD CONSTRAINT turmas_docencia_titular_fk FOREIGN KEY(escola_id,professor_titular_id) REFERENCES public.professores(escola_id,id),
  ADD COLUMN tempo_lectivo_minutos integer CHECK (tempo_lectivo_minutos BETWEEN 1 AND 240),
  ADD CONSTRAINT turmas_docencia_titular_check CHECK (
    (regime_docencia = 'pluridocencia' AND professor_titular_id IS NULL) OR
    (regime_docencia IN ('monodocencia','misto') AND professor_titular_id IS NOT NULL));

-- Only a uniform configured duration is a safe projection before timetable publication.
CREATE FUNCTION public.teacher_period_minutes(p_escola_id uuid,p_turma_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT COALESCE(t.tempo_lectivo_minutos, (
    SELECT CASE WHEN count(*) > 0 AND min(extract(epoch FROM (s.fim-s.inicio))) =
      max(extract(epoch FROM (s.fim-s.inicio))) AND min(extract(epoch FROM (s.fim-s.inicio))) > 0
      AND mod(min(extract(epoch FROM (s.fim-s.inicio)))::numeric,60)=0
      THEN (min(extract(epoch FROM (s.fim-s.inicio)))/60)::integer END
    FROM public.horario_slots s
    WHERE s.escola_id=t.escola_id AND NOT COALESCE(s.is_intervalo,false)
      AND s.turno_id=CASE upper(t.turno) WHEN 'M' THEN 'matinal' WHEN 'T' THEN 'tarde' WHEN 'N' THEN 'noite' END
  )) FROM public.turmas t WHERE t.id=p_turma_id AND t.escola_id=p_escola_id
$$;
REVOKE ALL ON FUNCTION public.teacher_period_minutes(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- One workload calculation for individual, batch (delegates to individual) and replacement.
CREATE FUNCTION public.teacher_weekly_load_internal(p_escola_id uuid,p_ano_id uuid,p_professor_id uuid,
  p_exclude_turma uuid DEFAULT NULL,p_exclude_disciplina uuid DEFAULT NULL)
RETURNS TABLE(tempos integer,minutos bigint) LANGUAGE sql STABLE SET search_path = '' AS $$
 WITH per_subject AS (
   SELECT td.turma_id,cm.disciplina_id,
     MAX(COALESCE(td.carga_horaria_semanal,cm.carga_horaria_semanal,0)) AS tempos
   FROM public.turma_disciplinas td
   JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=td.escola_id AND tu.session_id=p_ano_id
   JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
     AND cm.curso_id=tu.curso_id AND cm.classe_id=tu.classe_id AND cm.ativo
   JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id
     AND cc.ano_letivo_id=p_ano_id AND cc.status='published'
   WHERE td.escola_id=p_escola_id
     AND NOT (td.turma_id IS NOT DISTINCT FROM p_exclude_turma AND cm.disciplina_id IS NOT DISTINCT FROM p_exclude_disciplina)
     AND (td.professor_id=p_professor_id OR EXISTS (
       SELECT 1 FROM public.turma_disciplinas_professores tdp
       WHERE tdp.escola_id=p_escola_id AND tdp.turma_id=td.turma_id
         AND tdp.disciplina_id=cm.disciplina_id AND tdp.professor_id=p_professor_id))
   GROUP BY td.turma_id,cm.disciplina_id
 ), loads AS (
   SELECT ps.tempos,public.teacher_period_minutes(p_escola_id,ps.turma_id) AS duracao
   FROM per_subject ps
 )
 SELECT COALESCE(sum(loads.tempos),0)::integer,
   CASE WHEN count(*) FILTER (WHERE loads.tempos>0 AND loads.duracao IS NULL)>0 THEN NULL
        ELSE COALESCE(sum(loads.tempos::bigint*loads.duracao),0)::bigint END
 FROM loads
$$;
REVOKE ALL ON FUNCTION public.teacher_weekly_load_internal(uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.teacher_workload_exceeds(p_escola_id uuid,p_turma_id uuid,p_current_periods integer,
  p_current_minutes bigint,p_new_periods integer,p_limit_periods integer,p_limit_minutes integer)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE v_duration integer;
BEGIN
  IF p_limit_minutes IS NULL THEN
    RETURN COALESCE(p_limit_periods,0)>0 AND p_current_periods+p_new_periods>p_limit_periods;
  END IF;
  v_duration:=public.teacher_period_minutes(p_escola_id,p_turma_id);
  IF p_current_minutes IS NULL OR (p_new_periods>0 AND v_duration IS NULL) THEN
    RAISE EXCEPTION 'TEACHER_LOAD_DURATION_UNCONFIGURED';
  END IF;
  RETURN p_current_minutes+COALESCE(p_new_periods::bigint*v_duration,0)>p_limit_minutes;
END
$$;
REVOKE ALL ON FUNCTION public.teacher_workload_exceeds(uuid,uuid,integer,bigint,integer,integer,integer) FROM PUBLIC,anon,authenticated;

-- Explicit unit selection, never silently reinterpret a historic period limit.
CREATE FUNCTION public.configure_teacher_workload_atomic(p_escola_id uuid,p_professor_id uuid,
  p_unidade text,p_limite integer,p_contratual_minutos integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_ano uuid; v_tempos integer; v_minutos bigint;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu
 WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_LOAD_FORBIDDEN'; END IF;
 IF p_unidade IS NULL OR p_unidade NOT IN ('tempos','minutos') OR p_limite IS NULL
   OR p_limite<=0 OR (p_unidade='tempos' AND p_limite>100)
   OR (p_unidade='minutos' AND p_limite>10080)
   OR (p_contratual_minutos IS NOT NULL AND p_contratual_minutos NOT BETWEEN 1 AND 10080)
 THEN RAISE EXCEPTION 'TEACHER_LOAD_INVALID'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 IF v_ano IS NOT NULL THEN
   SELECT w.tempos,w.minutos INTO v_tempos,v_minutos FROM public.teacher_weekly_load_internal(p_escola_id,v_ano,p_professor_id) w;
   IF p_unidade='minutos' AND v_minutos IS NULL THEN RAISE EXCEPTION 'TEACHER_LOAD_DURATION_UNCONFIGURED'; END IF;
   IF (p_unidade='tempos' AND v_tempos>p_limite) OR (p_unidade='minutos' AND v_minutos>p_limite)
   THEN RAISE EXCEPTION 'TEACHER_LOAD_BELOW_ASSIGNED'; END IF;
 END IF;
 UPDATE public.teachers t SET
   carga_horaria_maxima=CASE WHEN p_unidade='tempos' THEN p_limite ELSE t.carga_horaria_maxima END,
   carga_lectiva_limite_minutos=CASE WHEN p_unidade='minutos' THEN p_limite ELSE NULL END,
   carga_contratual_minutos=p_contratual_minutos
 FROM public.professores pr
 WHERE pr.id=p_professor_id AND pr.escola_id=p_escola_id AND t.escola_id=pr.escola_id AND t.profile_id=pr.profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_LOAD_NOT_FOUND'; END IF;
END
$$;
REVOKE ALL ON FUNCTION public.configure_teacher_workload_atomic(uuid,uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.configure_teacher_workload_atomic(uuid,uuid,text,integer,integer) TO authenticated;

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
  v_limite_minutos integer;
  v_carga_minutos bigint;
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

  -- Use the exact same lock as the batch RPC, BEFORE reading workload.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('klasse:teacher-assign:' || p_escola_id::text, 0)
  );

  SELECT a.id INTO v_ano_id
  FROM public.anos_letivos a
  WHERE a.escola_id = p_escola_id AND a.ativo = true
  ORDER BY a.data_inicio DESC NULLS LAST, a.ano DESC, a.id
  LIMIT 1;
  IF v_ano_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ANO_INATIVO';
  END IF;


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

  SELECT pr.profile_id, t.id, t.carga_horaria_maxima, t.carga_lectiva_limite_minutos
    INTO v_prof_profile_id, v_teacher_id, v_carga_maxima, v_limite_minutos
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
  SELECT w.tempos,w.minutos INTO v_carga_atual,v_carga_minutos
  FROM public.teacher_weekly_load_internal(p_escola_id,v_ano_id,p_professor_id) w;
  IF NOT COALESCE(v_exists,false) AND public.teacher_workload_exceeds(
    p_escola_id,p_turma_id,v_carga_atual,v_carga_minutos,v_carga_nova,v_carga_maxima,v_limite_minutos) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_CARGA_EXCEEDED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.turmas tu WHERE tu.id=p_turma_id AND tu.escola_id=p_escola_id
    AND tu.regime_docencia='monodocencia' AND tu.professor_titular_id IS DISTINCT FROM p_professor_id) THEN
    RAISE EXCEPTION 'TEACHER_MONODOCENCIA_TITULAR_MISMATCH';
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
$function$;

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
  v_limite_minutos integer;
  v_carga_minutos bigint;
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

  SELECT p.profile_id, t.carga_horaria_maxima,t.carga_lectiva_limite_minutos
  INTO v_prof_profile_id, v_carga_maxima,v_limite_minutos
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
  SELECT w.tempos,w.minutos INTO v_carga_atual,v_carga_minutos
  FROM public.teacher_weekly_load_internal(p_escola_id,v_ano_id,p_professor_novo_id,p_turma_id,v_disciplina_id) w;
  IF public.teacher_workload_exceeds(p_escola_id,p_turma_id,v_carga_atual,v_carga_minutos,v_carga_nova,v_carga_maxima,v_limite_minutos) THEN
    RAISE EXCEPTION 'TEACHER_REPLACE_WORKLOAD_EXCEEDED';
  END IF;
  -- The confirmed per-subject CAS is an explicit specialist assignment, not a
  -- titular replacement. Preserve the titular and require another live subject.
  IF EXISTS (SELECT 1 FROM public.turmas tu WHERE tu.id=p_turma_id AND tu.escola_id=p_escola_id
    AND tu.professor_titular_id=p_professor_anterior_id AND tu.professor_titular_id IS DISTINCT FROM p_professor_novo_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.turma_disciplinas td
      JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id AND cm.ativo
      JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id
        AND cc.ano_letivo_id=v_ano_id AND cc.status='published'
      JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=td.escola_id
        AND tu.curso_id=cm.curso_id AND tu.classe_id=cm.classe_id
      WHERE td.escola_id=p_escola_id AND td.turma_id=p_turma_id AND cm.disciplina_id<>v_disciplina_id
        AND (td.professor_id=p_professor_anterior_id OR EXISTS (
          SELECT 1 FROM public.turma_disciplinas_professores tdp WHERE tdp.escola_id=p_escola_id
           AND tdp.turma_id=p_turma_id AND tdp.disciplina_id=cm.disciplina_id AND tdp.professor_id=p_professor_anterior_id))
    ) THEN RAISE EXCEPTION 'TEACHER_REGIME_TITULAR_LAST_SUBJECT'; END IF;
    UPDATE public.turmas SET regime_docencia='misto'
      WHERE id=p_turma_id AND escola_id=p_escola_id AND regime_docencia='monodocencia';
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
$function$;

-- Assign every published offering (mono) or an explicit subset (mixed).
-- Existing ownership is protected by the same individual transaction; a late
-- failure rolls back the entire operation and the regime change.
CREATE FUNCTION public.assign_teacher_regime_atomic(p_escola_id uuid,p_turma_id uuid,p_regime text,
  p_professor_id uuid DEFAULT NULL,p_matriz_ids uuid[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_ano uuid; v_item uuid; v_ids uuid[]; v_total integer:=0;
 v_regime_actual text; v_titular_actual uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
    AND eu.user_id=v_actor AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_REGIME_FORBIDDEN'; END IF;
 IF p_regime IS NULL OR p_regime NOT IN ('monodocencia','pluridocencia','misto') THEN RAISE EXCEPTION 'TEACHER_REGIME_INVALID'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 SELECT tu.regime_docencia,tu.professor_titular_id INTO v_regime_actual,v_titular_actual
 FROM public.turmas tu WHERE tu.id=p_turma_id AND tu.escola_id=p_escola_id AND tu.session_id=v_ano FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_REGIME_TURMA_INVALID'; END IF;
 IF p_regime='monodocencia' AND v_titular_actual IS NOT NULL AND v_titular_actual IS DISTINCT FROM p_professor_id
 THEN RAISE EXCEPTION 'TEACHER_REGIME_TITULAR_CONFLICT'; END IF;
 -- A partial specialist assignment may extend monodocência into mixed; existing owners still cannot be overwritten.
 IF p_regime='pluridocencia' THEN
   IF p_professor_id IS NOT NULL OR p_matriz_ids IS NOT NULL THEN RAISE EXCEPTION 'TEACHER_REGIME_INVALID'; END IF;
   UPDATE public.turmas SET regime_docencia=p_regime,professor_titular_id=NULL WHERE id=p_turma_id AND escola_id=p_escola_id;
   RETURN 0;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.professores pr JOIN public.teachers t ON t.escola_id=pr.escola_id AND t.profile_id=pr.profile_id
   WHERE pr.id=p_professor_id AND pr.escola_id=p_escola_id) THEN RAISE EXCEPTION 'TEACHER_REGIME_PROFESSOR_INVALID'; END IF;
 SELECT array_agg(td.curso_matriz_id ORDER BY td.curso_matriz_id) INTO v_ids
 FROM public.turma_disciplinas td
 JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=td.escola_id
 JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
   AND cm.curso_id=tu.curso_id AND cm.classe_id=tu.classe_id AND cm.ativo
 JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id
   AND cc.ano_letivo_id=v_ano AND cc.status='published'
 WHERE td.escola_id=p_escola_id AND td.turma_id=p_turma_id;
 IF COALESCE(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'TEACHER_REGIME_NO_OFFERINGS'; END IF;
 IF p_regime='misto' THEN
   IF COALESCE(cardinality(p_matriz_ids),0)=0 OR cardinality(p_matriz_ids)>100 OR array_position(p_matriz_ids,NULL) IS NOT NULL
       OR NOT p_matriz_ids <@ v_ids THEN RAISE EXCEPTION 'TEACHER_REGIME_INVALID_SUBSET'; END IF;
   v_ids:=ARRAY(SELECT DISTINCT x FROM unnest(p_matriz_ids) x ORDER BY x);
 ELSIF p_matriz_ids IS NOT NULL THEN RAISE EXCEPTION 'TEACHER_REGIME_INVALID_SUBSET'; END IF;
 -- Configure within the same transaction so the single-RPC mono guard is effective.
 -- Subset assignment must not silently downgrade monodocência or replace the titular.
 IF NOT (p_regime='misto' AND v_regime_actual='monodocencia' AND v_titular_actual=p_professor_id) THEN
   UPDATE public.turmas SET regime_docencia=p_regime,
     professor_titular_id=COALESCE(v_titular_actual,p_professor_id)
   WHERE id=p_turma_id AND escola_id=p_escola_id;
 END IF;
 FOREACH v_item IN ARRAY v_ids LOOP
   PERFORM public.assign_professor_turma_disciplina_atomic(p_escola_id,p_turma_id,v_item,p_professor_id,NULL,NULL);
   v_total:=v_total+1;
 END LOOP;
 RETURN v_total;
END
$$;
REVOKE ALL ON FUNCTION public.assign_teacher_regime_atomic(uuid,uuid,text,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_teacher_regime_atomic(uuid,uuid,text,uuid,uuid[]) TO authenticated;

-- Read model: separate configured unit, contract and actual projected teaching load.
CREATE FUNCTION public.get_teacher_workload_config(p_escola_id uuid,p_professor_id uuid)
RETURNS TABLE(unidade text,limite integer,contratual_minutos integer,tempos_atribuidos integer,minutos_atribuidos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_ano uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
 AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_LOAD_FORBIDDEN'; END IF;
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 RETURN QUERY SELECT CASE WHEN t.carga_lectiva_limite_minutos IS NULL THEN 'tempos' ELSE 'minutos' END,
   COALESCE(t.carga_lectiva_limite_minutos,t.carga_horaria_maxima),t.carga_contratual_minutos,
   CASE WHEN v_ano IS NULL THEN NULL ELSE w.tempos END,CASE WHEN v_ano IS NULL THEN NULL ELSE w.minutos END
 FROM public.teachers t JOIN public.professores pr ON pr.escola_id=t.escola_id AND pr.profile_id=t.profile_id
 CROSS JOIN LATERAL public.teacher_weekly_load_internal(p_escola_id,v_ano,p_professor_id) w
 WHERE t.escola_id=p_escola_id AND pr.id=p_professor_id;
END
$$;
REVOKE ALL ON FUNCTION public.get_teacher_workload_config(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_workload_config(uuid,uuid) TO authenticated;

-- Protect new configuration from direct PostgREST writes, without breaking existing
-- ordinary turma and teacher writes. This trigger must remain SECURITY INVOKER.
CREATE FUNCTION public.guard_teacher_workload_config_write()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('anon','authenticated') THEN
  IF TG_TABLE_NAME='teachers' THEN
   IF TG_OP='INSERT' THEN
    IF NEW.carga_contratual_minutos IS NOT NULL OR NEW.carga_lectiva_limite_minutos IS NOT NULL THEN RAISE EXCEPTION 'TEACHER_CONFIG_RPC_REQUIRED'; END IF;
   ELSIF NEW.carga_contratual_minutos IS DISTINCT FROM OLD.carga_contratual_minutos OR NEW.carga_lectiva_limite_minutos IS DISTINCT FROM OLD.carga_lectiva_limite_minutos THEN
    RAISE EXCEPTION 'TEACHER_CONFIG_RPC_REQUIRED';
   END IF;
  ELSE
   IF TG_OP='INSERT' THEN
    IF NEW.regime_docencia<>'pluridocencia' OR NEW.professor_titular_id IS NOT NULL OR NEW.tempo_lectivo_minutos IS NOT NULL THEN RAISE EXCEPTION 'TEACHER_CONFIG_RPC_REQUIRED'; END IF;
   ELSIF NEW.regime_docencia IS DISTINCT FROM OLD.regime_docencia OR NEW.professor_titular_id IS DISTINCT FROM OLD.professor_titular_id OR NEW.tempo_lectivo_minutos IS DISTINCT FROM OLD.tempo_lectivo_minutos THEN
    RAISE EXCEPTION 'TEACHER_CONFIG_RPC_REQUIRED';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_teacher_workload_config_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_guard_teacher_workload_config BEFORE INSERT OR UPDATE ON public.teachers
 FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_workload_config_write();
CREATE TRIGGER trg_guard_turma_docencia_config BEFORE INSERT OR UPDATE ON public.turmas
 FOR EACH ROW EXECUTE FUNCTION public.guard_teacher_workload_config_write();

-- Guard current published links even when an older writer bypasses the assignment RPC.
-- Archived/draft curriculum is deliberately excluded. SECURITY DEFINER is read-only
-- apart from the same transaction lock; no direct EXECUTE grant.
CREATE FUNCTION public.guard_monodocencia_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_titular uuid; v_regime text; v_ano uuid; v_disciplina uuid;
 v_new_periods integer; v_count integer; v_limit_periods integer; v_limit_minutes integer;
 v_current_periods integer; v_current_minutes bigint; v_existing boolean;
BEGIN
 IF NEW.professor_id IS NULL THEN RETURN NEW; END IF;
 IF pg_catalog.current_setting('role',true)='authenticated'
    AND NEW.escola_id IS DISTINCT FROM public.current_tenant_escola_id()
 THEN RAISE EXCEPTION 'ASSIGN_PROF_FORBIDDEN'; END IF;
 IF TG_OP='UPDATE' THEN
   IF NEW.professor_id IS NOT DISTINCT FROM OLD.professor_id AND NEW.turma_id=OLD.turma_id AND NEW.escola_id=OLD.escola_id THEN
     IF TG_TABLE_NAME='turma_disciplinas' THEN
       IF NEW.curso_matriz_id=OLD.curso_matriz_id AND NEW.carga_horaria_semanal IS NOT DISTINCT FROM OLD.carga_horaria_semanal THEN RETURN NEW; END IF;
     ELSIF NEW.disciplina_id=OLD.disciplina_id THEN RETURN NEW; END IF;
   END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||NEW.escola_id::text,0));
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=NEW.escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 SELECT t.professor_titular_id,t.regime_docencia INTO v_titular,v_regime FROM public.turmas t
 WHERE t.id=NEW.turma_id AND t.escola_id=NEW.escola_id AND t.session_id=v_ano;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='turma_disciplinas' THEN
  SELECT cm.disciplina_id,COALESCE(NEW.carga_horaria_semanal,cm.carga_horaria_semanal,0)
  INTO v_disciplina,v_new_periods FROM public.curso_matriz cm
  JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=cm.escola_id
    AND cc.ano_letivo_id=v_ano AND cc.status='published'
  JOIN public.turmas tu ON tu.id=NEW.turma_id AND tu.escola_id=cm.escola_id
    AND tu.curso_id=cm.curso_id AND tu.classe_id=cm.classe_id
  WHERE cm.id=NEW.curso_matriz_id AND cm.escola_id=NEW.escola_id AND cm.ativo;
  IF NOT FOUND THEN RETURN NEW; END IF;
 ELSE
  v_disciplina:=NEW.disciplina_id;
  SELECT count(*)::integer,MAX(COALESCE(td.carga_horaria_semanal,cm.carga_horaria_semanal,0)) INTO v_count,v_new_periods
  FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id AND cm.ativo
  JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=td.escola_id AND tu.curso_id=cm.curso_id AND tu.classe_id=cm.classe_id
  JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id
    AND cc.ano_letivo_id=v_ano AND cc.status='published'
  WHERE td.escola_id=NEW.escola_id AND td.turma_id=NEW.turma_id AND cm.disciplina_id=v_disciplina;
  IF v_count=0 THEN RETURN NEW; END IF;
 END IF;
 IF v_regime='monodocencia' AND NEW.professor_id IS DISTINCT FROM v_titular THEN
  RAISE EXCEPTION 'TEACHER_MONODOCENCIA_TITULAR_MISMATCH';
 END IF;
 -- Repeated writes to the second representation are not additional assignments.
 SELECT EXISTS(SELECT 1 FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id AND cm.ativo
  JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id AND cc.ano_letivo_id=v_ano AND cc.status='published'
  WHERE td.escola_id=NEW.escola_id AND td.turma_id=NEW.turma_id AND cm.disciplina_id=v_disciplina AND td.professor_id=NEW.professor_id)
 OR EXISTS(SELECT 1 FROM public.turma_disciplinas_professores tdp WHERE tdp.escola_id=NEW.escola_id
 AND tdp.turma_id=NEW.turma_id AND tdp.disciplina_id=v_disciplina AND tdp.professor_id=NEW.professor_id)
 INTO v_existing;
 IF v_existing THEN
   IF TG_TABLE_NAME='turma_disciplinas' AND TG_OP='UPDATE' THEN
     IF NEW.carga_horaria_semanal IS NOT DISTINCT FROM OLD.carga_horaria_semanal AND NEW.curso_matriz_id=OLD.curso_matriz_id THEN RETURN NEW; END IF;
   ELSE RETURN NEW; END IF;
 END IF;
 SELECT t.carga_horaria_maxima,t.carga_lectiva_limite_minutos INTO v_limit_periods,v_limit_minutes
 FROM public.professores pr JOIN public.teachers t ON t.escola_id=pr.escola_id AND t.profile_id=pr.profile_id
 WHERE pr.id=NEW.professor_id AND pr.escola_id=NEW.escola_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGN_PROF_PROFESSOR_NOT_FOUND'; END IF;
 SELECT w.tempos,w.minutos INTO v_current_periods,v_current_minutes
 FROM public.teacher_weekly_load_internal(NEW.escola_id,v_ano,NEW.professor_id,NEW.turma_id,v_disciplina) w;
 IF public.teacher_workload_exceeds(NEW.escola_id,NEW.turma_id,v_current_periods,v_current_minutes,
    v_new_periods,v_limit_periods,v_limit_minutes) THEN
  RAISE EXCEPTION 'ASSIGN_PROF_CARGA_EXCEEDED';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_monodocencia_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_guard_mono_td BEFORE INSERT OR UPDATE OF professor_id,turma_id,escola_id,curso_matriz_id,carga_horaria_semanal ON public.turma_disciplinas
 FOR EACH ROW EXECUTE FUNCTION public.guard_monodocencia_assignment();
CREATE TRIGGER trg_guard_mono_tdp BEFORE INSERT OR UPDATE OF professor_id,turma_id,escola_id,disciplina_id ON public.turma_disciplinas_professores
 FOR EACH ROW EXECUTE FUNCTION public.guard_monodocencia_assignment();

-- Existing teacher edit/import endpoints also share the assignment lock when
-- the effective legacy limit changes; unchanged historic overloads are preserved.
CREATE FUNCTION public.guard_legacy_teacher_limit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ano uuid; v_prof uuid; v_load integer;
BEGIN
 IF NEW.carga_horaria_maxima IS NOT DISTINCT FROM OLD.carga_horaria_maxima OR NEW.carga_lectiva_limite_minutos IS NOT NULL THEN RETURN NEW; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||NEW.escola_id::text,0));
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=NEW.escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 SELECT pr.id INTO v_prof FROM public.professores pr WHERE pr.escola_id=NEW.escola_id AND pr.profile_id=NEW.profile_id;
 IF v_ano IS NOT NULL AND v_prof IS NOT NULL THEN
  SELECT w.tempos INTO v_load FROM public.teacher_weekly_load_internal(NEW.escola_id,v_ano,v_prof) w;
  IF v_load>NEW.carga_horaria_maxima THEN RAISE EXCEPTION 'TEACHER_LOAD_BELOW_ASSIGNED'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_legacy_teacher_limit_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_guard_legacy_teacher_limit BEFORE UPDATE OF carga_horaria_maxima ON public.teachers
 FOR EACH ROW EXECUTE FUNCTION public.guard_legacy_teacher_limit_change();

-- Explicit titular replacement. The same CAS, workload engine and audit paths
-- are reused for each subject, and all changes are rolled back together.
CREATE FUNCTION public.replace_teacher_titular_atomic(p_escola_id uuid,p_turma_id uuid,
 p_professor_anterior_id uuid,p_professor_novo_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_ano uuid; v_regime text; v_titular uuid;
 v_item record; v_total integer:=0;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=v_actor
 AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_REGIME_FORBIDDEN'; END IF;
 IF p_professor_anterior_id IS NULL OR p_professor_novo_id IS NULL OR p_professor_anterior_id=p_professor_novo_id THEN RAISE EXCEPTION 'TEACHER_REPLACE_INVALID_INPUT'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 SELECT t.regime_docencia,t.professor_titular_id INTO v_regime,v_titular FROM public.turmas t
 WHERE t.id=p_turma_id AND t.escola_id=p_escola_id AND t.session_id=v_ano FOR UPDATE;
 IF NOT FOUND OR v_regime='pluridocencia' OR v_titular IS DISTINCT FROM p_professor_anterior_id THEN RAISE EXCEPTION 'TEACHER_REGIME_TITULAR_CONFLICT'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.professores pr JOIN public.teachers t ON t.escola_id=pr.escola_id AND t.profile_id=pr.profile_id
 WHERE pr.id=p_professor_novo_id AND pr.escola_id=p_escola_id) THEN RAISE EXCEPTION 'TEACHER_REGIME_PROFESSOR_INVALID'; END IF;
 UPDATE public.turmas SET professor_titular_id=p_professor_novo_id WHERE id=p_turma_id AND escola_id=p_escola_id;
 FOR v_item IN
   SELECT td.curso_matriz_id,td.professor_id AS owner,tdp.professor_id AS shared_owner
   FROM public.turma_disciplinas td
   JOIN public.turmas tu ON tu.id=td.turma_id AND tu.escola_id=td.escola_id
   JOIN public.curso_matriz cm ON cm.id=td.curso_matriz_id AND cm.escola_id=td.escola_id
     AND cm.curso_id=tu.curso_id AND cm.classe_id=tu.classe_id AND cm.ativo
   JOIN public.curso_curriculos cc ON cc.id=cm.curso_curriculo_id AND cc.escola_id=td.escola_id AND cc.ano_letivo_id=v_ano AND cc.status='published'
   LEFT JOIN public.turma_disciplinas_professores tdp ON tdp.escola_id=td.escola_id AND tdp.turma_id=td.turma_id AND tdp.disciplina_id=cm.disciplina_id
   WHERE td.escola_id=p_escola_id AND td.turma_id=p_turma_id
     AND (v_regime='monodocencia' OR td.professor_id=p_professor_anterior_id OR tdp.professor_id=p_professor_anterior_id)
   ORDER BY td.curso_matriz_id
 LOOP
   IF v_item.owner=p_professor_anterior_id OR v_item.shared_owner=p_professor_anterior_id THEN
     PERFORM public.trocar_professor_turma_disciplina_atomic(p_escola_id,p_turma_id,v_item.curso_matriz_id,p_professor_anterior_id,p_professor_novo_id);
   ELSIF v_item.owner IS NULL AND v_item.shared_owner IS NULL AND v_regime='monodocencia' THEN
     PERFORM public.assign_professor_turma_disciplina_atomic(p_escola_id,p_turma_id,v_item.curso_matriz_id,p_professor_novo_id,NULL,NULL);
   ELSE
     RAISE EXCEPTION 'TEACHER_REGIME_TITULAR_CONFLICT';
   END IF;
   v_total:=v_total+1;
 END LOOP;
 IF v_total=0 THEN RAISE EXCEPTION 'TEACHER_REGIME_NO_OFFERINGS'; END IF;
 RETURN v_total;
END $$;
REVOKE ALL ON FUNCTION public.replace_teacher_titular_atomic(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_teacher_titular_atomic(uuid,uuid,uuid,uuid) TO authenticated;


-- One configuration writer shared by registration, editing and the standalone RPC.
-- No public execute grant: callers must authorize before entering this helper.
CREATE FUNCTION public.apply_teacher_workload_internal(p_escola_id uuid,p_profile_id uuid,p_unidade text,p_limite integer,p_contratual_minutos integer)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_ano uuid; v_prof uuid; v_periods integer; v_minutes integer; v_contract integer; v_load integer; v_actual bigint;
BEGIN
 IF p_unidade IS NULL OR p_unidade NOT IN ('tempos','minutos') OR p_limite IS NULL OR p_limite<=0
  OR (p_unidade='tempos' AND p_limite>100) OR (p_unidade='minutos' AND p_limite>10080)
  OR (p_contratual_minutos IS NOT NULL AND p_contratual_minutos NOT BETWEEN 1 AND 10080)
  OR (p_unidade='minutos' AND p_contratual_minutos IS NOT NULL AND p_limite>p_contratual_minutos)
 THEN RAISE EXCEPTION 'TEACHER_LOAD_INVALID'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
 SELECT t.carga_horaria_maxima,t.carga_lectiva_limite_minutos,t.carga_contratual_minutos INTO v_periods,v_minutes,v_contract
 FROM public.teachers t WHERE t.escola_id=p_escola_id AND t.profile_id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_LOAD_NOT_FOUND'; END IF;
 -- Existing overloads or unknown historical durations do not block unrelated edits.
 IF v_contract IS NOT DISTINCT FROM p_contratual_minutos AND
    ((p_unidade='tempos' AND v_minutes IS NULL AND v_periods=p_limite) OR (p_unidade='minutos' AND v_minutes=p_limite))
 THEN RETURN; END IF;
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo
 ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 SELECT pr.id INTO v_prof FROM public.professores pr WHERE pr.escola_id=p_escola_id AND pr.profile_id=p_profile_id;
 IF v_ano IS NOT NULL AND v_prof IS NOT NULL THEN
   SELECT w.tempos,w.minutos INTO v_load,v_actual FROM public.teacher_weekly_load_internal(p_escola_id,v_ano,v_prof) w;
   IF p_unidade='minutos' AND v_actual IS NULL THEN RAISE EXCEPTION 'TEACHER_LOAD_DURATION_UNCONFIGURED'; END IF;
   IF (p_unidade='tempos' AND v_load>p_limite) OR (p_unidade='minutos' AND v_actual>p_limite) THEN RAISE EXCEPTION 'TEACHER_LOAD_BELOW_ASSIGNED'; END IF;
 END IF;
 UPDATE public.teachers SET carga_horaria_maxima=CASE WHEN p_unidade='tempos' THEN p_limite ELSE carga_horaria_maxima END,
 carga_lectiva_limite_minutos=CASE WHEN p_unidade='minutos' THEN p_limite ELSE NULL END,
 carga_contratual_minutos=p_contratual_minutos
 WHERE escola_id=p_escola_id AND profile_id=p_profile_id;
END $$;
REVOKE ALL ON FUNCTION public.apply_teacher_workload_internal(uuid,uuid,text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.configure_teacher_workload_atomic(p_escola_id uuid,p_professor_id uuid,
 p_unidade text,p_limite integer,p_contratual_minutos integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_profile uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id
 AND eu.user_id=(SELECT auth.uid()) AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_LOAD_FORBIDDEN'; END IF;
 SELECT pr.profile_id INTO v_profile FROM public.professores pr WHERE pr.escola_id=p_escola_id AND pr.id=p_professor_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TEACHER_LOAD_NOT_FOUND'; END IF;
 PERFORM public.apply_teacher_workload_internal(p_escola_id,v_profile,p_unidade,p_limite,p_contratual_minutos);
END $$;
REVOKE ALL ON FUNCTION public.configure_teacher_workload_atomic(uuid,uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.configure_teacher_workload_atomic(uuid,uuid,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_or_update_professor_academico(p_escola_id uuid, p_user_id uuid, p_profile jsonb, p_teacher jsonb, p_disciplina_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teacher_id uuid;
  v_professor_id uuid;
  v_valid_disciplina_ids uuid[] := '{}';
  v_skills_inserted int := 0;
BEGIN
  IF p_escola_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'escola_id e user_id são obrigatórios';
  END IF;

  -- Direct RPC callers must be school managers; service callers remain supported.
  IF COALESCE(pg_catalog.current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    AND ((SELECT auth.uid()) IS NULL OR NOT EXISTS (SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id=p_escola_id AND eu.user_id=(SELECT auth.uid())
      AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro')))
  THEN RAISE EXCEPTION 'TEACHER_CREATE_FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.user_id=p_user_id AND eu.escola_id<>p_escola_id)
    OR EXISTS (SELECT 1 FROM public.teachers t WHERE t.profile_id=p_user_id AND t.escola_id<>p_escola_id)
    OR EXISTS (SELECT 1 FROM public.professores pr WHERE pr.profile_id=p_user_id AND pr.escola_id<>p_escola_id)
  THEN RAISE EXCEPTION 'TEACHER_CREATE_SHARED_IDENTITY'; END IF;
  IF COALESCE(p_profile->>'role','professor') <> 'professor' THEN RAISE EXCEPTION 'TEACHER_CREATE_INVALID_ROLE'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
  INSERT INTO public.profiles (
    user_id,
    email,
    nome,
    telefone,
    role,
    escola_id,
    current_escola_id
  )
  VALUES (
    p_user_id,
    p_profile->>'email',
    p_profile->>'nome',
    NULLIF(p_profile->>'telefone', ''),
    COALESCE((p_profile->>'role')::public.user_role, 'professor'::public.user_role),
    p_escola_id,
    p_escola_id
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    nome = EXCLUDED.nome,
    telefone = EXCLUDED.telefone,
    role = CASE
      WHEN public.profiles.role = 'professor'::public.user_role OR public.profiles.role IS NULL
        THEN EXCLUDED.role
      ELSE public.profiles.role
    END,
    escola_id = EXCLUDED.escola_id,
    current_escola_id = EXCLUDED.current_escola_id;

  INSERT INTO public.escola_users (
    escola_id,
    user_id,
    papel
  )
  VALUES (
    p_escola_id,
    p_user_id,
    'professor'
  )
  ON CONFLICT (escola_id, user_id)
  DO UPDATE SET
    papel = CASE
      WHEN public.escola_users.papel = 'professor' OR public.escola_users.papel IS NULL
        THEN 'professor'
      ELSE public.escola_users.papel
    END;

  SELECT id
    INTO v_professor_id
  FROM public.professores
  WHERE escola_id = p_escola_id
    AND profile_id = p_user_id
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 1;

  IF v_professor_id IS NULL THEN
    INSERT INTO public.professores (escola_id, profile_id)
    VALUES (p_escola_id, p_user_id)
    RETURNING id INTO v_professor_id;
  END IF;

  INSERT INTO public.teachers (
    escola_id,
    profile_id,
    nome_completo,
    genero,
    data_nascimento,
    numero_bi,
    telefone_principal,
    habilitacoes,
    area_formacao,
    vinculo_contratual,
    carga_horaria_maxima,
    turnos_disponiveis,
    is_diretor_turma
  )
  VALUES (
    p_escola_id,
    p_user_id,
    p_teacher->>'nome_completo',
    p_teacher->>'genero',
    NULLIF(p_teacher->>'data_nascimento', '')::date,
    NULLIF(p_teacher->>'numero_bi', ''),
    NULLIF(p_teacher->>'telefone_principal', ''),
    p_teacher->>'habilitacoes',
    NULLIF(p_teacher->>'area_formacao', ''),
    p_teacher->>'vinculo_contratual',
    COALESCE((p_teacher->>'carga_horaria_maxima')::integer, 0),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_teacher->'turnos_disponiveis', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE((p_teacher->>'is_diretor_turma')::boolean, false)
  )
  ON CONFLICT (escola_id, profile_id)
  DO UPDATE SET
    nome_completo = EXCLUDED.nome_completo,
    genero = EXCLUDED.genero,
    data_nascimento = EXCLUDED.data_nascimento,
    numero_bi = EXCLUDED.numero_bi,
    telefone_principal = EXCLUDED.telefone_principal,
    habilitacoes = EXCLUDED.habilitacoes,
    area_formacao = EXCLUDED.area_formacao,
    vinculo_contratual = EXCLUDED.vinculo_contratual,
    carga_horaria_maxima = CASE WHEN p_teacher ? 'carga_lectiva_unidade' THEN public.teachers.carga_horaria_maxima ELSE EXCLUDED.carga_horaria_maxima END,
    turnos_disponiveis = EXCLUDED.turnos_disponiveis,
    is_diretor_turma = EXCLUDED.is_diretor_turma,
    updated_at = now()
  RETURNING id INTO v_teacher_id;

  IF p_teacher ? 'carga_lectiva_unidade' THEN
    PERFORM public.apply_teacher_workload_internal(p_escola_id,p_user_id,p_teacher->>'carga_lectiva_unidade',(p_teacher->>'carga_lectiva_limite')::integer,(p_teacher->>'carga_contratual_minutos')::integer);
  END IF;

  DELETE FROM public.teacher_skills
  WHERE teacher_id = v_teacher_id;

  IF COALESCE(array_length(p_disciplina_ids, 1), 0) > 0 THEN
    SELECT COALESCE(array_agg(id), '{}')
      INTO v_valid_disciplina_ids
    FROM public.disciplinas_catalogo
    WHERE escola_id = p_escola_id
      AND id = ANY(p_disciplina_ids);

    IF COALESCE(array_length(v_valid_disciplina_ids, 1), 0) > 0 THEN
      INSERT INTO public.teacher_skills (escola_id, teacher_id, disciplina_id)
      SELECT p_escola_id, v_teacher_id, disciplina_id
      FROM unnest(v_valid_disciplina_ids) AS disciplina_id
      ON CONFLICT (teacher_id, disciplina_id)
      DO UPDATE SET escola_id = EXCLUDED.escola_id;

      GET DIAGNOSTICS v_skills_inserted = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'teacher_id', v_teacher_id,
    'professor_id', v_professor_id,
    'skills_count', v_skills_inserted,
    'valid_disciplina_ids', v_valid_disciplina_ids
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.update_teacher_details_atomic(p_escola_id uuid, p_profile_id uuid, p_details jsonb, p_skill_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_teacher_id uuid;
  v_nome text := pg_catalog.btrim(p_details ->> 'nome_completo');
  v_skill_ids uuid[] := COALESCE(p_skill_ids, ARRAY[]::uuid[]);
BEGIN
  IF auth.uid() IS NULL OR p_escola_id IS NULL OR p_profile_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.escola_id = p_escola_id AND eu.user_id = auth.uid()
      AND coalesce(eu.papel, eu.role) IN
        ('admin', 'admin_escola', 'admin_secretaria', 'admin_secretario', 'admin_financeiro', 'diretor', 'staff_admin', 'secretaria', 'secretaria_financeiro')
  ) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_FORBIDDEN';
  END IF;
  IF p_details IS NULL OR jsonb_typeof(p_details) <> 'object'
    OR v_nome IS NULL OR char_length(v_nome) < 3 OR char_length(v_nome) > 160
    OR cardinality(v_skill_ids) > 200 THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_INPUT';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('klasse:teacher-assign:'||p_escola_id::text,0));
  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  WHERE t.escola_id = p_escola_id AND t.profile_id = p_profile_id
    AND EXISTS (
      SELECT 1 FROM public.escola_users eu
      WHERE eu.escola_id = p_escola_id AND eu.user_id = p_profile_id
    )
  FOR UPDATE OF t;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_NOT_FOUND';
  END IF;

  IF (
    SELECT count(*) FROM public.disciplinas_catalogo d
    WHERE d.escola_id = p_escola_id AND d.id = ANY(v_skill_ids)
  ) <> cardinality(v_skill_ids) THEN
    RAISE EXCEPTION 'UPDATE_TEACHER_INVALID_SKILLS';
  END IF;

  IF p_details ? 'carga_lectiva_unidade' THEN
    PERFORM public.apply_teacher_workload_internal(p_escola_id,p_profile_id,p_details->>'carga_lectiva_unidade',(p_details->>'carga_lectiva_limite')::integer,(p_details->>'carga_contratual_minutos')::integer);
  END IF;

  UPDATE public.teachers SET
    nome_completo = v_nome,
    genero = p_details ->> 'genero',
    data_nascimento = nullif(p_details ->> 'data_nascimento', '')::date,
    numero_bi = nullif(p_details ->> 'numero_bi', ''),
    telefone_principal = nullif(p_details ->> 'telefone_principal', ''),
    habilitacoes = p_details ->> 'habilitacoes',
    area_formacao = nullif(p_details ->> 'area_formacao', ''),
    vinculo_contratual = p_details ->> 'vinculo_contratual',
    carga_horaria_maxima = CASE WHEN p_details ? 'carga_lectiva_unidade' THEN carga_horaria_maxima ELSE (p_details ->> 'carga_horaria_maxima')::integer END,
    turnos_disponiveis = ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(p_details -> 'turnos_disponiveis', '[]'::jsonb))
    ),
    is_diretor_turma = COALESCE((p_details ->> 'is_diretor_turma')::boolean, false),
    updated_by = auth.uid()
  WHERE id = v_teacher_id AND escola_id = p_escola_id;

  -- profiles é global. Num docente de várias escolas, editar apenas o
  -- cadastro local de teachers para não modificar outra organização.
  IF NOT EXISTS (
    SELECT 1 FROM public.escola_users eu
    WHERE eu.user_id = p_profile_id AND eu.escola_id <> p_escola_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.professores p
    WHERE p.profile_id = p_profile_id AND p.escola_id <> p_escola_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.teachers t
    WHERE t.profile_id = p_profile_id AND t.escola_id <> p_escola_id
  ) THEN
    UPDATE public.profiles SET
      nome = v_nome,
      telefone = nullif(p_details ->> 'telefone_principal', '')
    WHERE user_id = p_profile_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'UPDATE_TEACHER_PROFILE_NOT_FOUND';
    END IF;
  END IF;

  DELETE FROM public.teacher_skills
  WHERE escola_id = p_escola_id AND teacher_id = v_teacher_id;

  INSERT INTO public.teacher_skills (escola_id, teacher_id, disciplina_id)
  SELECT p_escola_id, v_teacher_id, s.disciplina_id
  FROM pg_catalog.unnest(v_skill_ids) AS s(disciplina_id);
END;
$function$;

-- Batch read, no request-per-teacher; same calculation as write guards.
CREATE FUNCTION public.get_teacher_workloads_by_profiles(p_escola_id uuid,p_profile_ids uuid[])
RETURNS TABLE(profile_id uuid,tempos_atribuidos integer,minutos_atribuidos bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_ano uuid;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR p_escola_id IS DISTINCT FROM public.current_tenant_escola_id()
 OR NOT EXISTS (SELECT 1 FROM public.escola_users eu WHERE eu.escola_id=p_escola_id AND eu.user_id=(SELECT auth.uid())
 AND COALESCE(eu.papel,eu.role) IN ('admin','admin_escola','admin_secretaria','admin_secretario','admin_financeiro','diretor','staff_admin','secretaria','secretaria_financeiro'))
 THEN RAISE EXCEPTION 'TEACHER_LOAD_FORBIDDEN'; END IF;
 IF COALESCE(cardinality(p_profile_ids),0)=0 THEN RETURN; END IF;
 IF cardinality(p_profile_ids)>200 THEN RAISE EXCEPTION 'TEACHER_LOAD_INVALID'; END IF;
 SELECT a.id INTO v_ano FROM public.anos_letivos a WHERE a.escola_id=p_escola_id AND a.ativo ORDER BY a.data_inicio DESC NULLS LAST,a.ano DESC,a.id LIMIT 1;
 IF v_ano IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT pr.profile_id,w.tempos,w.minutos FROM public.professores pr
 CROSS JOIN LATERAL public.teacher_weekly_load_internal(p_escola_id,v_ano,pr.id) w
 WHERE pr.escola_id=p_escola_id AND pr.profile_id=ANY(p_profile_ids);
END $$;
REVOKE ALL ON FUNCTION public.get_teacher_workloads_by_profiles(uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_teacher_workloads_by_profiles(uuid,uuid[]) TO authenticated;
