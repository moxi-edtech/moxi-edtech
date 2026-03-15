BEGIN;

CREATE OR REPLACE FUNCTION public.can_bypass_pauta_lock(
  p_escola_id uuid,
  p_turma_id uuid,
  p_avaliacao_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trimestre smallint;
  v_disciplina_id uuid;
BEGIN
  SELECT a.trimestre, COALESCE(cm.disciplina_id, td.avaliacao_disciplina_id)
  INTO v_trimestre, v_disciplina_id
  FROM public.avaliacoes a
  JOIN public.turma_disciplinas td ON td.id = a.turma_disciplina_id
  LEFT JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  WHERE a.id = p_avaliacao_id;

  RETURN EXISTS (
    SELECT 1 FROM public.excecoes_pauta
    WHERE escola_id = p_escola_id
      AND turma_id = p_turma_id
      AND user_id = p_user_id
      AND expira_em > now()
      AND (trimestre IS NULL OR trimestre = v_trimestre)
      AND (disciplina_id IS NULL OR disciplina_id = v_disciplina_id)
  );
END;
$$;

COMMIT;
