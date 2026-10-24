BEGIN;

-- The function returns a column named disciplina_id. Qualify the timetable
-- column in the synchronization query so PL/pgSQL cannot confuse it with the
-- output parameter.
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
SET search_path = public
AS $function$
DECLARE
  v_disciplina_id uuid;
  v_prof_profile_id uuid;
  v_teacher_id uuid;
  v_carga_maxima integer;
  v_carga_atual integer;
  v_exists boolean;
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_curso_matriz_id IS NULL OR p_professor_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_INVALID_INPUT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.turmas t
    WHERE t.id = p_turma_id AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_TURMA_NOT_FOUND';
  END IF;

  SELECT cm.disciplina_id INTO v_disciplina_id
  FROM public.curso_matriz cm
  WHERE cm.id = p_curso_matriz_id AND cm.escola_id = p_escola_id
  LIMIT 1;
  IF v_disciplina_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_MATRIZ_NOT_FOUND';
  END IF;

  SELECT p.profile_id INTO v_prof_profile_id
  FROM public.professores p
  WHERE p.id = p_professor_id AND p.escola_id = p_escola_id
  LIMIT 1;
  IF v_prof_profile_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_PROFESSOR_NOT_FOUND';
  END IF;

  SELECT t.id, t.carga_horaria_maxima
  INTO v_teacher_id, v_carga_maxima
  FROM public.teachers t
  WHERE t.profile_id = v_prof_profile_id AND t.escola_id = p_escola_id
  LIMIT 1;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_TEACHER_NOT_FOUND';
  END IF;

  SELECT count(*)::int INTO v_carga_atual
  FROM public.turma_disciplinas_professores tdp
  WHERE tdp.escola_id = p_escola_id AND tdp.professor_id = p_professor_id;

  IF coalesce(v_carga_maxima, 0) > 0 AND v_carga_atual >= v_carga_maxima THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.turma_disciplinas_professores tdp
      WHERE tdp.escola_id = p_escola_id
        AND tdp.professor_id = p_professor_id
        AND tdp.turma_id = p_turma_id
        AND tdp.disciplina_id = v_disciplina_id
    ) THEN
      RAISE EXCEPTION 'ASSIGN_PROF_CARGA_EXCEEDED';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quadro_horarios current_row
    JOIN public.quadro_horarios occupied
      ON occupied.escola_id = p_escola_id
     AND occupied.versao_id = current_row.versao_id
     AND occupied.slot_id = current_row.slot_id
     AND occupied.professor_id = p_professor_id
     AND (occupied.turma_id <> p_turma_id OR occupied.disciplina_id <> v_disciplina_id)
    WHERE current_row.escola_id = p_escola_id
      AND current_row.turma_id = p_turma_id
      AND current_row.disciplina_id = v_disciplina_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_QUADRO_CONFLICT';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.turma_disciplinas_professores tdp
    WHERE tdp.escola_id = p_escola_id
      AND tdp.turma_id = p_turma_id
      AND tdp.disciplina_id = v_disciplina_id
      AND tdp.professor_id = p_professor_id
  ) INTO v_exists;

  INSERT INTO public.turma_disciplinas_professores (
    escola_id, turma_id, disciplina_id, professor_id, horarios, planejamento
  ) VALUES (
    p_escola_id, p_turma_id, v_disciplina_id, p_professor_id, p_horarios, p_planejamento
  )
  ON CONFLICT ON CONSTRAINT uq_tdp_unique_escola
  DO UPDATE SET
    professor_id = EXCLUDED.professor_id,
    horarios = COALESCE(EXCLUDED.horarios, public.turma_disciplinas_professores.horarios),
    planejamento = COALESCE(EXCLUDED.planejamento, public.turma_disciplinas_professores.planejamento),
    updated_at = now();

  UPDATE public.turma_disciplinas td
  SET professor_id = p_professor_id
  WHERE td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id
    AND td.curso_matriz_id = p_curso_matriz_id;

  UPDATE public.quadro_horarios qh
  SET professor_id = p_professor_id
  WHERE qh.escola_id = p_escola_id
    AND qh.turma_id = p_turma_id
    AND qh.disciplina_id = v_disciplina_id
    AND qh.professor_id IS DISTINCT FROM p_professor_id;

  RETURN QUERY SELECT
    CASE WHEN v_exists THEN 'updated' ELSE 'created' END::text,
    v_disciplina_id, v_prof_profile_id, v_carga_atual, v_carga_maxima;
END;
$function$;

ALTER FUNCTION public.assign_professor_turma_disciplina_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.assign_professor_turma_disciplina_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) TO authenticated;

COMMIT;
