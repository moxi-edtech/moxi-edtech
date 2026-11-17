-- Teacher assignment hardening. Migration is atomic; no historical assignment backfill.
BEGIN;

CREATE OR REPLACE FUNCTION public.assign_professor_turmas_disciplina_batch(
  p_escola_id uuid, p_professor_id uuid, p_disciplina_id uuid, p_itens jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_item jsonb;
  v_turma_id uuid;
  v_matriz_id uuid;
  v_owner uuid;
  v_shared_owner uuid;
  v_disciplina_id uuid;
  v_count integer;
  v_total integer := 0;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF (SELECT auth.uid()) IS NULL OR p_escola_id IS NULL
     OR p_professor_id IS NULL OR p_disciplina_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.escola_users eu
       WHERE eu.escola_id = p_escola_id AND eu.user_id = (SELECT auth.uid())
         AND COALESCE(eu.papel, eu.role) IN ('admin', 'admin_escola', 'admin_secretaria', 'admin_secretario', 'admin_financeiro', 'diretor', 'staff_admin', 'secretaria', 'secretaria_financeiro')
     ) THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professores p
    JOIN public.teachers teacher
      ON teacher.escola_id = p.escola_id AND teacher.profile_id = p.profile_id
    WHERE p.id = p_professor_id AND p.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_PROFESSOR_NOT_FOUND';
  END IF;

  IF p_itens IS NULL OR pg_catalog.jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_INPUT';
  END IF;
  v_count := pg_catalog.jsonb_array_length(p_itens);
  IF v_count NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_COUNT';
  END IF;

  -- Every single/batch assignment uses the same school-wide transaction lock.
  -- It also serializes different teachers competing for one vacant subject.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('klasse:teacher-assign:' || p_escola_id::text, 0)
  );

  FOR v_item IN
    SELECT value FROM pg_catalog.jsonb_array_elements(p_itens)
    ORDER BY value ->> 'turma_id'
  LOOP
    IF pg_catalog.jsonb_typeof(v_item) <> 'object'
       OR NOT (v_item ? 'turma_id' AND v_item ? 'curso_matriz_id') THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_ITEM';
    END IF;
    v_turma_id := (v_item ->> 'turma_id')::uuid;
    v_matriz_id := (v_item ->> 'curso_matriz_id')::uuid;
    IF v_turma_id IS NULL OR v_matriz_id IS NULL OR v_turma_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_INVALID_ITEM';
    END IF;
    v_seen := pg_catalog.array_append(v_seen, v_turma_id);

    -- A selected matrix must be published for the CURRENT year and this
    -- turma's course/class; never accept a historical or draft offering.
    SELECT td.professor_id, cm.disciplina_id
    INTO v_owner, v_disciplina_id
    FROM public.turma_disciplinas td
    JOIN public.turmas tu ON tu.id = td.turma_id AND tu.escola_id = p_escola_id
    JOIN public.anos_letivos ano
      ON ano.id = tu.session_id AND ano.escola_id = p_escola_id AND ano.ativo = true
    JOIN public.curso_matriz cm
      ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
     AND cm.curso_id = tu.curso_id AND cm.classe_id = tu.classe_id
     AND cm.ativo = true
    JOIN public.curso_curriculos cc
      ON cc.id = cm.curso_curriculo_id AND cc.escola_id = p_escola_id
     AND cc.ano_letivo_id = ano.id AND cc.status = 'published'
    WHERE td.escola_id = p_escola_id AND td.turma_id = v_turma_id
      AND td.curso_matriz_id = v_matriz_id
    FOR UPDATE OF td;

    IF NOT FOUND OR v_disciplina_id IS DISTINCT FROM p_disciplina_id THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_DISCIPLINA_INCOMPATIVEL: %', v_turma_id;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.turma_disciplinas td
      JOIN public.curso_matriz cm
        ON cm.id = td.curso_matriz_id AND cm.escola_id = p_escola_id
      WHERE td.escola_id = p_escola_id AND td.turma_id = v_turma_id
        AND cm.disciplina_id = p_disciplina_id
        AND td.professor_id IS NOT NULL AND td.professor_id <> p_professor_id
    ) THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_JA_ATRIBUIDA: %', v_turma_id;
    END IF;

    v_shared_owner := NULL;
    SELECT tdp.professor_id INTO v_shared_owner
    FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = p_escola_id AND tdp.turma_id = v_turma_id
      AND tdp.disciplina_id = p_disciplina_id
    FOR UPDATE;

    IF (v_owner IS NOT NULL AND v_owner <> p_professor_id)
       OR (v_shared_owner IS NOT NULL AND v_shared_owner <> p_professor_id) THEN
      RAISE EXCEPTION 'ASSIGN_BATCH_JA_ATRIBUIDA: %', v_turma_id;
    END IF;

    IF v_owner IS DISTINCT FROM p_professor_id
       OR v_shared_owner IS DISTINCT FROM p_professor_id THEN
      PERFORM public.assign_professor_turma_disciplina_atomic(
        p_escola_id, v_turma_id, v_matriz_id, p_professor_id, NULL, NULL
      );
      IF v_owner IS NULL AND v_shared_owner IS NULL THEN
        v_total := v_total + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_professor_turmas_disciplina_batch(uuid,uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_professor_turmas_disciplina_batch(uuid,uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_teacher_details_atomic(
  p_escola_id uuid,
  p_profile_id uuid,
  p_details jsonb,
  p_skill_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  SELECT t.id INTO v_teacher_id
  FROM public.teachers t
  JOIN public.professores p ON p.escola_id = t.escola_id AND p.profile_id = t.profile_id
  WHERE t.escola_id = p_escola_id AND t.profile_id = p_profile_id
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

  UPDATE public.teachers SET
    nome_completo = v_nome,
    genero = p_details ->> 'genero',
    data_nascimento = nullif(p_details ->> 'data_nascimento', '')::date,
    numero_bi = nullif(p_details ->> 'numero_bi', ''),
    telefone_principal = nullif(p_details ->> 'telefone_principal', ''),
    habilitacoes = p_details ->> 'habilitacoes',
    area_formacao = nullif(p_details ->> 'area_formacao', ''),
    vinculo_contratual = p_details ->> 'vinculo_contratual',
    carga_horaria_maxima = (p_details ->> 'carga_horaria_maxima')::integer,
    turnos_disponiveis = ARRAY(
      SELECT jsonb_array_elements_text(COALESCE(p_details -> 'turnos_disponiveis', '[]'::jsonb))
    ),
    is_diretor_turma = COALESCE((p_details ->> 'is_diretor_turma')::boolean, false)
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

REVOKE ALL ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_teacher_details_atomic(uuid,uuid,jsonb,uuid[]) TO authenticated;


-- A função individual já existia como SECURITY DEFINER e era executável
-- por authenticated sem autorização no banco. Aplicar o mesmo isolamento
-- a qualquer origem de chamada (UI, API ou Data API).
CREATE OR REPLACE FUNCTION public.assign_professor_turma_disciplina_atomic(
  p_escola_id uuid,
  p_turma_id uuid,
  p_curso_matriz_id uuid,
  p_professor_id uuid,
  p_horarios jsonb DEFAULT NULL,
  p_planejamento jsonb DEFAULT NULL
)
RETURNS TABLE (
  mode text,
  disciplina_id uuid,
  professor_profile_id uuid,
  carga_atual integer,
  carga_maxima integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Only published schedules in the SAME school and academic year count.
  -- Compare overlapping days/times across different timetable versions;
  -- versao_id equality cannot detect conflicts between different turmas.
  IF EXISTS (
    SELECT 1
    FROM public.quadro_horarios target
    JOIN public.horario_versoes tv
      ON tv.id = target.versao_id AND tv.escola_id = p_escola_id
     AND tv.status = 'publicada'
    JOIN public.horario_slots ts
      ON ts.id = target.slot_id AND ts.escola_id = p_escola_id
    JOIN public.quadro_horarios occupied
      ON occupied.escola_id = p_escola_id
     AND occupied.professor_id = p_professor_id
     AND (occupied.turma_id <> p_turma_id OR occupied.disciplina_id <> v_disciplina_id)
    JOIN public.turmas ot
      ON ot.id = occupied.turma_id AND ot.escola_id = p_escola_id
     AND ot.session_id = v_ano_id
    JOIN public.horario_versoes ov
      ON ov.id = occupied.versao_id AND ov.escola_id = p_escola_id
     AND ov.status = 'publicada'
    JOIN public.horario_slots os
      ON os.id = occupied.slot_id AND os.escola_id = p_escola_id
     AND os.dia_semana = ts.dia_semana
     AND os.inicio < ts.fim AND ts.inicio < os.fim
    WHERE target.escola_id = p_escola_id AND target.turma_id = p_turma_id
      AND target.disciplina_id = v_disciplina_id
      AND COALESCE(ts.is_intervalo, false) = false
      AND COALESCE(os.is_intervalo, false) = false
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_QUADRO_CONFLICT';
  END IF;

  -- If an existing timetable assigns this subject to someone else,
  -- never silently replace that person's name.
  IF EXISTS (
    SELECT 1 FROM public.quadro_horarios qh
    WHERE qh.escola_id = p_escola_id AND qh.turma_id = p_turma_id
      AND qh.disciplina_id = v_disciplina_id
      AND qh.professor_id IS NOT NULL AND qh.professor_id <> p_professor_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_ALREADY_ASSIGNED';
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

  UPDATE public.quadro_horarios qh
  SET professor_id = p_professor_id
  WHERE qh.escola_id = p_escola_id AND qh.turma_id = p_turma_id
    AND qh.disciplina_id = v_disciplina_id
    AND qh.professor_id IS NULL;

  RETURN QUERY SELECT
    CASE WHEN v_exists THEN 'updated' ELSE 'created' END::text,
    v_disciplina_id, v_prof_profile_id, v_carga_atual, v_carga_maxima;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_professor_turma_disciplina_atomic(uuid,uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_professor_turma_disciplina_atomic(uuid,uuid,uuid,uuid,jsonb,jsonb) TO authenticated, service_role;

COMMIT;
