-- Matricular em massa por turma (a partir de um import_id)
-- Seleciona staging_alunos compatíveis com a turma (ano_letivo, classe_numero, turno, letra)
-- Faz matching de alunos (profile_id -> BI -> email) e cria/reativa matrículas

CREATE OR REPLACE FUNCTION public.matricular_em_massa_por_turma(
  p_import_id  uuid,
  p_escola_id  uuid,
  p_turma_id   uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors  integer := 0;
  v_error_details jsonb := '[]'::jsonb;
  v_turma record;
  v_classe_num integer;
  v_turno_codigo text;
  v_ano_letivo_num integer;
  v_letra text;
  v_aluno_id uuid;
BEGIN
  -- Carregar turma e validar escola
  SELECT t.id, t.escola_id, t.nome, t.ano_letivo, t.session_id, t.classe_id, t.turno
    INTO v_turma
  FROM public.turmas t
  WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma não encontrada ou não pertence à escola';
  END IF;

  -- Resolver classe_numero
  SELECT c.numero INTO v_classe_num FROM public.classes c WHERE c.id = v_turma.classe_id;

  -- Resolver turno (M/T/N)
  IF v_turma.turno IS NOT NULL THEN
    IF lower(v_turma.turno) LIKE 'm%' THEN v_turno_codigo := 'M';
    ELSIF lower(v_turma.turno) LIKE 't%' THEN v_turno_codigo := 'T';
    ELSIF lower(v_turma.turno) LIKE 'n%' THEN v_turno_codigo := 'N';
    ELSE v_turno_codigo := upper(substr(v_turma.turno,1,1));
    END IF;
  ELSE
    v_turno_codigo := NULL;
  END IF;

  -- Resolver ano letivo (primeiro ano numérico do nome)
  v_ano_letivo_num := NULL;
  IF v_turma.ano_letivo IS NOT NULL THEN
    SELECT COALESCE(NULLIF(regexp_replace(v_turma.ano_letivo, '.*?(\d{4}).*', '\1'), ''), NULL)::int
      INTO v_ano_letivo_num;
  END IF;
  IF v_ano_letivo_num IS NULL AND v_turma.session_id IS NOT NULL THEN
    PERFORM 1; -- fallback usando school_sessions.nome
    SELECT COALESCE(NULLIF(regexp_replace(s.nome, '.*?(\d{4}).*', '\1'), ''), NULL)::int
      INTO v_ano_letivo_num
    FROM public.school_sessions s
    WHERE s.id = v_turma.session_id;
  END IF;

  -- Derivar letra da turma a partir do nome (último token maiúsculo)
  v_letra := NULL;
  IF v_turma.nome IS NOT NULL THEN
    SELECT UPPER(regexp_replace(trim(regexp_replace(v_turma.nome, '^.*\s', '')), '[^A-Z]', '', 'g')) INTO v_letra;
    IF v_letra = '' THEN v_letra := NULL; END IF;
  END IF;

  -- Loop pelos registros do staging compatíveis
  FOR v_row IN
    SELECT sa.*
    FROM public.staging_alunos sa
    WHERE sa.import_id = p_import_id
      AND sa.escola_id = p_escola_id
      AND (v_ano_letivo_num IS NULL OR sa.ano_letivo = v_ano_letivo_num)
      AND (v_classe_num    IS NULL OR sa.classe_numero = v_classe_num)
      AND (v_turno_codigo  IS NULL OR sa.turno_codigo = v_turno_codigo)
      AND (v_letra         IS NULL OR sa.turma_letra = v_letra)
  LOOP
    -- Matching de aluno existente
    v_aluno_id := NULL;
    IF v_row.profile_id IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.profile_id = v_row.profile_id LIMIT 1;
    END IF;
    IF v_aluno_id IS NULL AND v_row.bi IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.bi_numero = v_row.bi LIMIT 1;
    END IF;
    IF v_aluno_id IS NULL AND v_row.email IS NOT NULL THEN
      SELECT a.id INTO v_aluno_id FROM public.alunos a WHERE a.escola_id = p_escola_id AND a.email = v_row.email LIMIT 1;
    END IF;

    IF v_aluno_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_object(
        'staging_id', v_row.id,
        'nome', v_row.nome,
        'erro', 'Aluno não encontrado (profile/BI/email)'
      );
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.matriculas (
        id, escola_id, aluno_id, turma_id, session_id, ano_letivo, status, numero_matricula, ativo, created_at
      ) VALUES (
        gen_random_uuid(), p_escola_id, v_aluno_id, p_turma_id, v_turma.session_id, v_turma.ano_letivo, 'ativo', v_row.numero_matricula, true, now()
      )
      ON CONFLICT (aluno_id, turma_id, ano_letivo) DO UPDATE SET
        status = 'ativo',
        numero_matricula = COALESCE(EXCLUDED.numero_matricula, public.matriculas.numero_matricula),
        ativo = true,
        updated_at = now();

      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_object(
        'staging_id', v_row.id,
        'aluno', v_row.nome,
        'erro', SQLERRM
      );
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;

