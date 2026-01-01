-- ======================================================================
--  FUNÇÃO: matricular_em_massa (v2)
--  - Usa campos de matrícula do staging_alunos:
--    curso_codigo, classe_numero, turno_codigo, turma_letra, ano_letivo
--  - Cria/atualiza matrículas em public.matriculas
--  - Deixa o trigger generate_matricula_number cuidar do número quando nulo
-- ======================================================================

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
  -- Garantir que a turma é da escola
  IF NOT EXISTS (
    SELECT 1
    FROM public.turmas t
    WHERE t.id = p_turma_id
      AND t.escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma não pertence à escola especificada';
  END IF;

  -- Loop pelos alunos do staging que pertencem ao grupo
  FOR v_row IN
    SELECT
      sa.id                AS staging_id,
      sa.nome              AS staging_nome,
      sa.numero_matricula  AS numero_matricula_staging,
      sa.profile_id        AS profile_id_staging,
      sa.bi                AS bi_staging,
      sa.email             AS email_staging,
      a.id                 AS aluno_id,
      a.nome               AS aluno_nome
    FROM public.staging_alunos sa
    LEFT JOIN public.alunos a
      ON a.escola_id = p_escola_id
     AND (
          (sa.profile_id IS NOT NULL AND a.profile_id = sa.profile_id)
       OR (sa.bi IS NOT NULL AND a.bi_numero = sa.bi)
       OR (sa.email IS NOT NULL AND a.email = sa.email)
     )
    WHERE sa.import_id     = p_import_id
      AND sa.escola_id     = p_escola_id
      AND sa.ano_letivo    = p_ano_letivo
      AND sa.curso_codigo  = p_curso_codigo
      AND sa.classe_numero = p_classe_numero
      AND sa.turno_codigo  = p_turno_codigo
      AND sa.turma_letra   = p_turma_letra
  LOOP
    -- Se não achar aluno correspondente, loga erro e segue
    IF v_row.aluno_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_object(
        'staging_id', v_row.staging_id,
        'nome',       v_row.staging_nome,
        'erro',       'Aluno não encontrado para este registro do staging (verificar profile_id/BI/email)'
      );
      CONTINUE;
    END IF;

    BEGIN
      -- Insere ou reativa matrícula
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
        v_row.numero_matricula_staging, -- pode ser NULL → trigger gera
        true,
        now()
      )
      ON CONFLICT (aluno_id, turma_id, ano_letivo)
      DO UPDATE SET
        ativo           = true,
        status          = 'ativo',
        numero_matricula = COALESCE(
          EXCLUDED.numero_matricula,
          public.matriculas.numero_matricula
        ),
        updated_at      = now();

      v_success := v_success + 1;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        v_error_details := v_error_details || jsonb_build_object(
          'staging_id', v_row.staging_id,
          'aluno',      COALESCE(v_row.aluno_nome, v_row.staging_nome),
          'erro',       SQLERRM
        );
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;