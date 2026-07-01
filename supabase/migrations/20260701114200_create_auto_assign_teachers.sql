-- Migration: Create auto_assign_school_teachers_by_specialty function
-- Version: 20260701114200

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_assign_school_teachers_by_specialty(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  r_td RECORD;
  v_disc_name text;
  v_matched_prof_id uuid;
  v_matched_prof_name text;
  v_count integer := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  -- Loop through all turma_disciplinas that have no teacher assigned
  FOR r_td IN 
    SELECT td.id, td.turma_id, td.curso_matriz_id, t.nome as turma_nome
    FROM public.turma_disciplinas td
    JOIN public.turmas t ON t.id = td.turma_id
    WHERE td.escola_id = p_escola_id
      AND td.professor_id IS NULL
  LOOP
    -- Get subject name
    SELECT d.nome
      INTO v_disc_name
    FROM public.curso_matriz cm
    JOIN public.disciplinas d ON d.id = cm.disciplina_id
    WHERE cm.id = r_td.curso_matriz_id
      AND cm.escola_id = p_escola_id;

    IF v_disc_name IS NOT NULL THEN
      -- Find matching teacher by specialty name substring
      SELECT p.id, pr.nome
        INTO v_matched_prof_id, v_matched_prof_name
      FROM public.professores p
      JOIN public.profiles pr ON pr.user_id = p.profile_id
      WHERE p.escola_id = p_escola_id
        AND (
          lower(pr.nome) LIKE '%' || lower(v_disc_name) || '%'
          OR lower(v_disc_name) LIKE '%' || lower(pr.nome) || '%'
        )
      LIMIT 1;

      IF v_matched_prof_id IS NOT NULL THEN
        -- Perform atomic assignment
        PERFORM public.assign_professor_turma_disciplina_atomic(
          p_escola_id,
          r_td.turma_id,
          r_td.curso_matriz_id,
          v_matched_prof_id,
          NULL,
          NULL
        );
        v_count := v_count + 1;
        v_details := v_details || jsonb_build_array(jsonb_build_object(
          'turma', r_td.turma_nome,
          'disciplina', v_disc_name,
          'professor', v_matched_prof_name
        ));
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'assigned_count', v_count,
    'assignments', v_details
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_assign_school_teachers_by_specialty(uuid) TO authenticated;

COMMIT;
