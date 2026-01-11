CREATE OR REPLACE FUNCTION public.hard_delete_aluno(
  p_aluno_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid;
  v_role text;
BEGIN
  SELECT escola_id INTO v_escola_id
  FROM public.alunos
  WHERE id = p_aluno_id;

  IF v_escola_id IS NULL THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT public.is_super_admin()
     AND COALESCE(v_role, '') NOT IN ('admin', 'admin_escola', 'global_admin', 'staff_admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND (p.current_escola_id = v_escola_id OR p.escola_id = v_escola_id)
     ) THEN
    RAISE EXCEPTION 'Aluno não pertence à escola ativa';
  END IF;

  PERFORM public.create_audit_event(
    v_escola_id,
    'hard_delete',
    'aluno',
    p_aluno_id::text,
    NULL,
    NULL,
    'secretaria',
    jsonb_build_object('reason', p_reason)
  );

  DELETE FROM public.alunos
  WHERE id = p_aluno_id
    AND escola_id = v_escola_id;
END;
$$;
