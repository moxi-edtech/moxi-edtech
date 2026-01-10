CREATE OR REPLACE FUNCTION public.hard_delete_curso(p_curso_id uuid, p_escola_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Defensive check: Ensure no matrículas are associated with the course (Adjustment 1)
  IF EXISTS (
    SELECT 1
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE t.curso_id = p_curso_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Curso possui matrículas e não pode ser removido';
  END IF;

  -- Deletion order is critical to respect foreign key constraints.
  
  -- 1. Delete from 'turmas' (Adjustment 2 - Simplified)
  DELETE FROM public.turmas t
  WHERE t.curso_id = p_curso_id
    AND t.escola_id = p_escola_id;

  -- 2. Delete from 'classes'
  DELETE FROM public.classes c
  WHERE c.curso_id = p_curso_id AND c.escola_id = p_escola_id;

  -- 3. Delete from 'disciplinas' (using disciplinas_legacy as identified)
  --    The column is `curso_escola_id` as per user's request, which matches `disciplinas_legacy.curso_escola_id`
  DELETE FROM public.disciplinas_legacy d
  WHERE d.curso_escola_id = p_curso_id AND d.escola_id = p_escola_id;

  -- 4. Delete from 'configuracoes_curriculo'
  DELETE FROM public.configuracoes_curriculo cc
  WHERE cc.curso_id = p_curso_id AND cc.escola_id = p_escola_id;

  -- 5. Add audit log entry (Adjustment 3)
  INSERT INTO public.audit_logs (
    escola_id,
    user_id, -- Assuming user_id can be retrieved via auth.uid() in a trigger or passed
    portal,
    action,
    entity,
    entity_id,
    details
  ) VALUES (
    p_escola_id,
    auth.uid(), -- Using auth.uid() directly within the function
    'secretaria', -- or appropriate portal name
    'hard_delete',
    'curso',
    p_curso_id::text,
    jsonb_build_object(
      'deleted_at', now(),
      'source', 'api_request',
      'triggered_by_rpc', 'hard_delete_curso'
    )
  );

  -- 6. Finally, delete the course itself
  DELETE FROM public.cursos c
  WHERE c.id = p_curso_id AND c.escola_id = p_escola_id;

END;
$$;
