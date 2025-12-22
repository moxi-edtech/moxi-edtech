CREATE OR REPLACE FUNCTION public.soft_delete_aluno(p_id uuid, p_deleted_by uuid, p_reason text)
RETURNS void AS $$
BEGIN
  UPDATE public.alunos
  SET deleted_at = timezone('utc', now()),
      status = 'inativo',
      deleted_by = p_deleted_by,
      deletion_reason = p_reason
  WHERE id = p_id;

  INSERT INTO public.alunos_excluidos (id, escola_id, aluno_id, nome, aluno_deleted_at, exclusao_motivo, excluido_por, snapshot)
  SELECT gen_random_uuid(), escola_id, id, nome, timezone('utc', now()), p_reason, p_deleted_by, row_to_json(public.alunos.*)::jsonb
  FROM public.alunos WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;