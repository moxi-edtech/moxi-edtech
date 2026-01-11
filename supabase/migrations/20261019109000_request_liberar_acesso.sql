CREATE OR REPLACE FUNCTION public.request_liberar_acesso(
  p_escola_id uuid,
  p_aluno_ids uuid[],
  p_canal text DEFAULT 'whatsapp'
)
RETURNS TABLE(
  aluno_id uuid,
  codigo_ativacao text,
  request_id uuid,
  enfileirado boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row record;
BEGIN
  IF NOT public.can_manage_school(p_escola_id) THEN
    RAISE EXCEPTION 'sem permissão para escola %', p_escola_id;
  END IF;

  FOR row IN
    SELECT * FROM public.liberar_acesso_alunos_v2(p_escola_id, p_aluno_ids, p_canal)
  LOOP
    PERFORM public.enqueue_outbox_event(
      p_escola_id,
      'auth_provision_student',
      jsonb_build_object('aluno_id', row.aluno_id, 'canal', p_canal),
      row.request_id
    );

    aluno_id := row.aluno_id;
    codigo_ativacao := row.codigo_ativacao;
    request_id := row.request_id;
    enfileirado := row.enfileirado;
    RETURN NEXT;
  END LOOP;
END;
$$;
