CREATE OR REPLACE FUNCTION public.create_or_confirm_matricula(
  p_aluno_id     uuid,
  p_turma_id     uuid,
  p_ano_letivo   integer,
  p_matricula_id uuid DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escola_id uuid;
  v_matricula_id uuid;
  v_numero_matricula bigint;
BEGIN
  -- A) Validar Aluno
  SELECT a.escola_id
    INTO v_escola_id
  FROM public.alunos a
  WHERE a.id = p_aluno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aluno não encontrado';
  END IF;

  -- B) Validar Turma (se informada)
  IF p_turma_id IS NOT NULL THEN
    PERFORM 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = v_escola_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Turma não pertence à escola do aluno';
    END IF;
  END IF;

  -- C) Buscar matrícula existente (determinístico)
  IF p_matricula_id IS NOT NULL THEN
    SELECT m.id, m.numero_matricula
      INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.id = p_matricula_id
      AND m.escola_id = v_escola_id
    FOR UPDATE;
  ELSE
    SELECT m.id, m.numero_matricula
      INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.aluno_id  = p_aluno_id
      AND m.ano_letivo = p_ano_letivo
      AND m.escola_id  = v_escola_id
    ORDER BY
      (m.status IN ('ativo','pendente')) DESC,
      m.created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- D) Criar ou atualizar
  IF v_matricula_id IS NULL THEN
    v_numero_matricula := public.next_matricula_number(v_escola_id);

    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, ano_letivo,
      status, numero_matricula, data_matricula, created_at
    ) VALUES (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo,
      'ativo', v_numero_matricula, current_date, now()
    )
    RETURNING id INTO v_matricula_id;

  ELSE
    IF v_numero_matricula IS NULL THEN
      v_numero_matricula := public.next_matricula_number(v_escola_id);
    END IF;

    UPDATE public.matriculas
    SET
      numero_matricula = v_numero_matricula,
      status = 'ativo',
      turma_id = COALESCE(p_turma_id, turma_id),
      updated_at = now()
    WHERE id = v_matricula_id;
  END IF;

  -- E) Sincronizar Login
  UPDATE public.profiles p
  SET numero_login = v_numero_matricula::text
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND p.user_id = a.profile_id
    AND p.role = 'aluno'
    AND (p.numero_login IS DISTINCT FROM v_numero_matricula::text);

  RETURN v_numero_matricula;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) TO service_role;
-- dummy comment