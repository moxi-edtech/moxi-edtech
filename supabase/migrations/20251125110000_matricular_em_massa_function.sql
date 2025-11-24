-- Índice único para evitar duplicidade de matrícula no mesmo ano e turma
CREATE UNIQUE INDEX IF NOT EXISTS idx_matriculas_unq_aluno_turma_ano
  ON public.matriculas (aluno_id, turma_id, ano_letivo);

-- Função RPC para matrícula em massa a partir do staging
CREATE OR REPLACE FUNCTION public.matricular_em_massa(
  p_import_id    uuid,
  p_escola_id    uuid,
  p_classe_label text,
  p_turma_label  text,
  p_ano_letivo   integer,
  p_turma_id     uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec          record;
  v_success      integer := 0;
  v_errors       integer := 0;
  v_error_detail jsonb   := '[]'::jsonb;
BEGIN
  -- Confere se a turma realmente pertence à escola
  IF NOT EXISTS (
    SELECT 1 FROM public.turmas
    WHERE id = p_turma_id
      AND escola_id = p_escola_id
  ) THEN
    RAISE EXCEPTION 'Turma não pertence à escola especificada';
  END IF;

  -- Para cada aluno no grupo
  FOR v_rec IN
    SELECT
      sa.id             AS staging_id,
      sa.numero_matricula,
      a.id              AS aluno_id,
      a.nome            AS aluno_nome
    FROM public.staging_alunos sa
    JOIN public.alunos a
      ON a.profile_id = sa.profile_id
     AND a.escola_id  = p_escola_id
    WHERE sa.import_id    = p_import_id
      AND sa.classe_label = p_classe_label
      AND sa.turma_label  = p_turma_label
      AND sa.ano_letivo   = p_ano_letivo
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
        v_rec.aluno_id,
        p_turma_id,
        p_ano_letivo::text,
        'ativo',
        COALESCE(
          v_rec.numero_matricula,
          p_ano_letivo::text || '-' || LPAD((v_success + 1)::text, 6, '0')
        ),
        true,
        now()
      )
      ON CONFLICT (aluno_id, turma_id, ano_letivo) DO UPDATE
      SET
        ativo            = true,
        status           = 'ativo',
        numero_matricula = COALESCE(
          EXCLUDED.numero_matricula,
          public.matriculas.numero_matricula
        );

      v_success := v_success + 1;

    EXCEPTION
      WHEN others THEN
        v_errors := v_errors + 1;
        v_error_detail := v_error_detail || jsonb_build_object(
          'aluno', v_rec.aluno_nome,
          'erro', SQLERRM
        );
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_detail;
END;
$$;
