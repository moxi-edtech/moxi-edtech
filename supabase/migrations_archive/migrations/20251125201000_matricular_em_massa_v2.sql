CREATE OR REPLACE FUNCTION public.matricular_em_massa(
  p_import_id     uuid,
  p_escola_id     uuid,
  p_curso_codigo  text,
  p_classe_numero integer,
  p_turno_codigo  text,
  p_turma_letra   text,
  p_ano_letivo    integer,
  p_turma_id      uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors  integer := 0;
  v_error_details jsonb := '[]'::jsonb;
BEGIN
  -- Garante que a turma pertence à escola
  IF NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma % não pertence à escola %', p_turma_id, p_escola_id;
  END IF;

  -- Loop pelos registros do staging do grupo
  FOR v_row IN
    SELECT
      sa.id               AS staging_id,
      sa.profile_id       AS staging_profile_id,
      sa.numero_matricula,
      a.id                AS aluno_id,
      a.nome              AS aluno_nome
    FROM public.staging_alunos sa
    JOIN public.alunos a
      ON a.escola_id = p_escola_id
     AND a.import_id = sa.import_id
     AND (
       -- link direto se profile_id foi preenchido
       (sa.profile_id IS NOT NULL AND a.profile_id = sa.profile_id)
       OR
       -- fallback: mesmo nome + data_nascimento (opcional)
       (sa.profile_id IS NULL
        AND a.nome = sa.nome
        AND (a.data_nascimento IS NULL OR a.data_nascimento = sa.data_nascimento)
       )
     )
    WHERE sa.import_id     = p_import_id
      AND sa.escola_id     = p_escola_id
      AND sa.curso_codigo  = p_curso_codigo
      AND sa.classe_numero = p_classe_numero
      AND sa.turno_codigo  = p_turno_codigo
      AND sa.turma_letra   = p_turma_letra
      AND sa.ano_letivo    = p_ano_letivo
  LOOP
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
        v_row.aluno_id,
        p_turma_id,
        p_ano_letivo,
        'ativo',
        NULL,      -- trigger generate_matricula_number cuida se vier NULL
        true,
        now()
      )
      ON CONFLICT (aluno_id, turma_id, ano_letivo)
      DO UPDATE SET
        ativo           = true,
        status          = 'ativo',
        updated_at      = now();

      v_success := v_success + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        v_error_details := v_error_details || jsonb_build_object(
          'staging_id', v_row.staging_id,
          'aluno',      v_row.aluno_nome,
          'erro',       SQLERRM
        );
    END;
  END LOOP;

  RETURN QUERY
  SELECT v_success, v_errors, v_error_details;
END;
$$;
