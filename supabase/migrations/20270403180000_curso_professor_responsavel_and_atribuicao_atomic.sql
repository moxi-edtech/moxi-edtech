BEGIN;

CREATE TABLE IF NOT EXISTS public.curso_professor_responsavel (
  escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.professores(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT curso_professor_responsavel_pkey PRIMARY KEY (escola_id, curso_id)
);

CREATE INDEX IF NOT EXISTS ix_curso_professor_responsavel_professor
  ON public.curso_professor_responsavel (escola_id, professor_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_curso_professor_responsavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_curso_professor_responsavel_updated_at
  ON public.curso_professor_responsavel;

CREATE TRIGGER trg_curso_professor_responsavel_updated_at
BEFORE UPDATE ON public.curso_professor_responsavel
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_curso_professor_responsavel();

CREATE OR REPLACE FUNCTION public.set_curso_professor_responsavel(
  p_escola_id uuid,
  p_curso_id uuid,
  p_professor_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  curso_id uuid,
  professor_id uuid,
  professor_profile_id uuid,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof_profile_id uuid;
BEGIN
  IF p_escola_id IS NULL OR p_curso_id IS NULL THEN
    RAISE EXCEPTION 'CURSO_PROF_INVALID_INPUT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.cursos c
    WHERE c.id = p_curso_id
      AND c.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'CURSO_PROF_CURSO_NOT_FOUND';
  END IF;

  IF p_professor_id IS NULL THEN
    DELETE FROM public.curso_professor_responsavel cpr
    WHERE cpr.escola_id = p_escola_id
      AND cpr.curso_id = p_curso_id;

    RETURN QUERY
    SELECT p_curso_id, NULL::uuid, NULL::uuid, now();
    RETURN;
  END IF;

  SELECT p.profile_id
  INTO v_prof_profile_id
  FROM public.professores p
  WHERE p.id = p_professor_id
    AND p.escola_id = p_escola_id
  LIMIT 1;

  IF v_prof_profile_id IS NULL THEN
    RAISE EXCEPTION 'CURSO_PROF_PROFESSOR_NOT_FOUND';
  END IF;

  INSERT INTO public.curso_professor_responsavel (
    escola_id,
    curso_id,
    professor_id,
    created_by,
    updated_by
  ) VALUES (
    p_escola_id,
    p_curso_id,
    p_professor_id,
    p_actor_id,
    p_actor_id
  )
  ON CONFLICT ON CONSTRAINT curso_professor_responsavel_pkey
  DO UPDATE SET
    professor_id = EXCLUDED.professor_id,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  RETURN QUERY
  SELECT cpr.curso_id, cpr.professor_id, v_prof_profile_id, cpr.updated_at
  FROM public.curso_professor_responsavel cpr
  WHERE cpr.escola_id = p_escola_id
    AND cpr.curso_id = p_curso_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_curso_professor_responsavel_map(
  p_escola_id uuid,
  p_curso_ids uuid[]
)
RETURNS TABLE (
  curso_id uuid,
  professor_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cpr.curso_id, cpr.professor_id
  FROM public.curso_professor_responsavel cpr
  WHERE cpr.escola_id = p_escola_id
    AND (
      p_curso_ids IS NULL
      OR cardinality(p_curso_ids) = 0
      OR cpr.curso_id = ANY (p_curso_ids)
    );
$$;

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
AS $$
DECLARE
  v_disciplina_id uuid;
  v_prof_profile_id uuid;
  v_teacher_id uuid;
  v_turno text;
  v_turno_label text;
  v_turnos_disponiveis text[];
  v_carga_maxima integer;
  v_carga_atual integer;
  v_exists boolean;
BEGIN
  IF p_escola_id IS NULL OR p_turma_id IS NULL OR p_curso_matriz_id IS NULL OR p_professor_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_INVALID_INPUT';
  END IF;

  SELECT t.turno
  INTO v_turno
  FROM public.turmas t
  WHERE t.id = p_turma_id
    AND t.escola_id = p_escola_id
  LIMIT 1;

  IF v_turno IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_TURMA_NOT_FOUND';
  END IF;

  SELECT cm.disciplina_id
  INTO v_disciplina_id
  FROM public.curso_matriz cm
  WHERE cm.id = p_curso_matriz_id
    AND cm.escola_id = p_escola_id
  LIMIT 1;

  IF v_disciplina_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_MATRIZ_NOT_FOUND';
  END IF;

  SELECT p.profile_id
  INTO v_prof_profile_id
  FROM public.professores p
  WHERE p.id = p_professor_id
    AND p.escola_id = p_escola_id
  LIMIT 1;

  IF v_prof_profile_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_PROFESSOR_NOT_FOUND';
  END IF;

  SELECT t.id, t.turnos_disponiveis, t.carga_horaria_maxima
  INTO v_teacher_id, v_turnos_disponiveis, v_carga_maxima
  FROM public.teachers t
  WHERE t.profile_id = v_prof_profile_id
    AND t.escola_id = p_escola_id
  LIMIT 1;

  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'ASSIGN_PROF_TEACHER_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.teacher_skills ts
    WHERE ts.escola_id = p_escola_id
      AND ts.teacher_id = v_teacher_id
      AND ts.disciplina_id = v_disciplina_id
  ) THEN
    RAISE EXCEPTION 'ASSIGN_PROF_SKILL_MISMATCH';
  END IF;

  v_turno_label := CASE upper(coalesce(v_turno, ''))
    WHEN 'M' THEN 'Manhã'
    WHEN 'T' THEN 'Tarde'
    WHEN 'N' THEN 'Noite'
    ELSE NULL
  END;

  IF cardinality(coalesce(v_turnos_disponiveis, ARRAY[]::text[])) > 0 THEN
    IF NOT (
      coalesce(v_turno_label, '') = ANY (v_turnos_disponiveis)
      OR upper(coalesce(v_turno, '')) = ANY (v_turnos_disponiveis)
    ) THEN
      RAISE EXCEPTION 'ASSIGN_PROF_TURNO_MISMATCH';
    END IF;
  END IF;

  SELECT count(*)::int
  INTO v_carga_atual
  FROM public.turma_disciplinas_professores tdp
  WHERE tdp.escola_id = p_escola_id
    AND tdp.professor_id = p_professor_id;

  IF coalesce(v_carga_maxima, 0) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM public.turma_disciplinas_professores tdp
      WHERE tdp.escola_id = p_escola_id
        AND tdp.professor_id = p_professor_id
        AND tdp.turma_id = p_turma_id
        AND tdp.disciplina_id = v_disciplina_id
    ) THEN
      -- no-op for capacity if this exact assignment already exists
      NULL;
    ELSIF v_carga_atual >= v_carga_maxima THEN
      RAISE EXCEPTION 'ASSIGN_PROF_CARGA_EXCEEDED';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.turma_disciplinas td
    WHERE td.escola_id = p_escola_id
      AND td.turma_id = p_turma_id
      AND td.curso_matriz_id = p_curso_matriz_id
  ) INTO v_exists;

  INSERT INTO public.turma_disciplinas (
    escola_id,
    turma_id,
    curso_matriz_id,
    professor_id
  ) VALUES (
    p_escola_id,
    p_turma_id,
    p_curso_matriz_id,
    p_professor_id
  )
  ON CONFLICT (escola_id, turma_id, curso_matriz_id)
  DO UPDATE SET professor_id = EXCLUDED.professor_id;

  INSERT INTO public.turma_disciplinas_professores (
    escola_id,
    turma_id,
    disciplina_id,
    professor_id,
    horarios,
    planejamento
  ) VALUES (
    p_escola_id,
    p_turma_id,
    v_disciplina_id,
    p_professor_id,
    p_horarios,
    p_planejamento
  )
  ON CONFLICT ON CONSTRAINT uq_tdp_unique_escola
  DO UPDATE SET
    professor_id = EXCLUDED.professor_id,
    horarios = COALESCE(EXCLUDED.horarios, public.turma_disciplinas_professores.horarios),
    planejamento = COALESCE(EXCLUDED.planejamento, public.turma_disciplinas_professores.planejamento),
    updated_at = now();

  SELECT count(*)::int
  INTO v_carga_atual
  FROM public.turma_disciplinas_professores tdp
  WHERE tdp.escola_id = p_escola_id
    AND tdp.professor_id = p_professor_id;

  RETURN QUERY
  SELECT
    CASE WHEN v_exists THEN 'updated' ELSE 'created' END,
    v_disciplina_id,
    v_prof_profile_id,
    v_carga_atual,
    v_carga_maxima;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_curso_professor_responsavel(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_curso_professor_responsavel_map(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_professor_turma_disciplina_atomic(uuid, uuid, uuid, uuid, jsonb, jsonb) TO authenticated;

COMMIT;
