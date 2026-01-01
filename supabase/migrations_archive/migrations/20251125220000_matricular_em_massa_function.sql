-- supabase/migrations/20251125220000_matricular_em_massa_function.sql

CREATE OR REPLACE FUNCTION public.matricular_em_massa(
  p_import_id      uuid,
  p_escola_id      uuid,
  p_curso_codigo   text,
  p_classe_numero  text,
  p_turno_codigo   text,
  p_turma_letra    text,
  p_ano_letivo     integer,
  p_turma_id       uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row            public.staging_alunos%ROWTYPE;
  v_aluno_id       uuid;
  v_success        integer := 0;
  v_errors         integer := 0;
  v_error_details  jsonb   := '[]'::jsonb;
BEGIN
  -- 1) Garantir que a turma pertence à escola
  IF NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma % não pertence à escola %', p_turma_id, p_escola_id;
  END IF;

  -- 2) Loop nos alunos do staging que pertencem a este grupo
  FOR v_row IN
    SELECT sa.*
    FROM public.staging_alunos sa
    WHERE sa.import_id      = p_import_id
      AND sa.escola_id      = p_escola_id
      AND sa.curso_codigo   = p_curso_codigo
      AND sa.classe_numero  = p_classe_numero
      AND sa.turno_codigo   = p_turno_codigo
      AND sa.turma_letra    = p_turma_letra
      AND sa.ano_letivo     = p_ano_letivo
  LOOP
    -- 2.1) Resolver aluno_id a partir dos dados disponíveis
    v_aluno_id := NULL;

    -- Tenta por profile_id se houver
    IF v_row.profile_id IS NOT NULL THEN
      SELECT a.id
      INTO v_aluno_id
      FROM public.alunos a
      WHERE a.escola_id   = p_escola_id
        AND a.profile_id  = v_row.profile_id
      ORDER BY a.created_at DESC
      LIMIT 1;
    END IF;

    -- Tenta por BI
    IF v_aluno_id IS NULL AND v_row.bi IS NOT NULL THEN
      SELECT a.id
      INTO v_aluno_id
      FROM public.alunos a
      WHERE a.escola_id = p_escola_id
        AND a.bi_numero = v_row.bi
      ORDER BY a.created_at DESC
      LIMIT 1;
    END IF;

    -- Tenta por email
    IF v_aluno_id IS NULL AND v_row.email IS NOT NULL THEN
      SELECT a.id
      INTO v_aluno_id
      FROM public.alunos a
      WHERE a.escola_id = p_escola_id
        AND lower(a.email) = lower(v_row.email)
      ORDER BY a.created_at DESC
      LIMIT 1;
    END IF;

    -- Tenta por telefone
    IF v_aluno_id IS NULL AND v_row.telefone IS NOT NULL THEN
      SELECT a.id
      INTO v_aluno_id
      FROM public.alunos a
      WHERE a.escola_id = p_escola_id
        AND a.telefone = v_row.telefone
      ORDER BY a.created_at DESC
      LIMIT 1;
    END IF;

    -- Se ainda não achou aluno, registra erro e segue
    IF v_aluno_id IS NULL THEN
      v_errors := v_errors + 1;

      INSERT INTO public.import_errors (
        import_id,
        row_number,
        column_name,
        message,
        raw_value
      )
      VALUES (
        p_import_id,
        v_row.id::integer,
        'aluno_id',
        'Aluno não encontrado para este registro (verificar BI/email/telefone/profile_id)',
        row_to_json(v_row)::text
      );

      v_error_details := v_error_details || jsonb_build_object(
        'staging_id', v_row.id,
        'motivo', 'aluno_nao_encontrado'
      );

      CONTINUE;
    END IF;

    -- 2.2) Criar ou atualizar matrícula
    BEGIN
      INSERT INTO public.matriculas (
        id,
        escola_id,
        aluno_id,
        turma_id,
        ano_letivo,
        status,
        numero_matricula,
        ativo,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        p_escola_id,
        v_aluno_id,
        p_turma_id,
        p_ano_letivo,
        'ativo',
        v_row.numero_matricula,  -- pode ser NULL -> trigger gera
        true,
        now()
      )
      ON CONFLICT (aluno_id, turma_id, ano_letivo)
      DO UPDATE SET
        status           = 'ativo',
        ativo            = true,
        numero_matricula = COALESCE(
          EXCLUDED.numero_matricula,
          public.matriculas.numero_matricula
        ),
        updated_at       = now();

      v_success := v_success + 1;

      -- (Opcional) marcar linha do staging como processada
      UPDATE public.staging_alunos
      SET processed_at = now()
      WHERE id = v_row.id;

    EXCEPTION
      WHEN others THEN
        v_errors := v_errors + 1;

        INSERT INTO public.import_errors (
          import_id,
          row_number,
          column_name,
          message,
          raw_value
        )
        VALUES (
          p_import_id,
          v_row.id::integer,
          'matriculas',
          SQLERRM,
          row_to_json(v_row)::text
        );

        v_error_details := v_error_details || jsonb_build_object(
          'staging_id', v_row.id,
          'motivo', 'erro_ao_inserir_matricula',
          'erro', SQLERRM
        );
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;