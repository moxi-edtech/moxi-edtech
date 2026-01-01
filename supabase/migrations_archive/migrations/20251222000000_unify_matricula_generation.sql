-- Unifica a geração de número de matrícula em um único caminho baseado em matricula_counters
-- Remove o trigger/funcão legados e garante que qualquer INSERT direto em matriculas use o contador novo
-- Também atualiza as funções de matrícula em massa para delegarem para create_or_confirm_matricula

-- 1) Remover legado baseado em sequência global
DROP TRIGGER IF EXISTS trg_generate_matricula_number ON public.matriculas;
DROP FUNCTION IF EXISTS public.generate_matricula_number();

-- 2) Novo trigger que usa a função centralizada de contagem por escola
CREATE OR REPLACE FUNCTION public.trg_set_matricula_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  IF NEW.numero_matricula IS NULL THEN
    v_num := public.next_matricula_number(NEW.escola_id);
    NEW.numero_matricula := v_num;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_matricula_number ON public.matriculas;
CREATE TRIGGER trg_set_matricula_number
BEFORE INSERT ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_matricula_number();

-- 3) Atualiza a função de matrícula em massa (por staging) para usar create_or_confirm_matricula
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
SECURITY DEFINER
AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors  integer := 0;
  v_error_details jsonb := '[]'::jsonb;
BEGIN
  -- Valida turma
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  -- Loop no Staging
  FOR v_row IN
    SELECT sa.id AS staging_id, sa.nome AS staging_nome, sa.bi, sa.email, sa.telefone, sa.profile_id, a.id AS aluno_id
    FROM public.staging_alunos sa
    LEFT JOIN public.alunos a ON a.escola_id = p_escola_id AND (
       (sa.profile_id IS NOT NULL AND a.profile_id = sa.profile_id) OR
       (sa.bi IS NOT NULL AND a.bi_numero = sa.bi) OR
       (sa.email IS NOT NULL AND a.email = sa.email) OR
       (sa.telefone IS NOT NULL AND a.telefone = sa.telefone)
    )
    WHERE sa.import_id = p_import_id AND sa.escola_id = p_escola_id
      AND sa.ano_letivo = p_ano_letivo AND sa.curso_codigo = p_curso_codigo
      AND sa.classe_numero = p_classe_numero AND sa.turno_codigo = p_turno_codigo
      AND sa.turma_letra = p_turma_letra
  LOOP
    IF v_row.aluno_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.staging_id, 'nome', v_row.staging_nome, 'erro', 'Aluno não encontrado'
      ));
      CONTINUE;
    END IF;

    BEGIN
      -- Delega tudo para a função central (gera número e sincroniza login)
      PERFORM public.create_or_confirm_matricula(v_row.aluno_id, p_turma_id, p_ano_letivo);

      v_success := v_success + 1;

      -- (Opcional) marcar linha do staging como processada
      UPDATE public.staging_alunos
      SET processed_at = now()
      WHERE id = v_row.staging_id;

    EXCEPTION WHEN others THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.staging_id,
        'aluno', v_row.staging_nome,
        'erro', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;

-- 4) Atualiza a função de matrícula em massa por turma para usar create_or_confirm_matricula
CREATE OR REPLACE FUNCTION public.matricular_em_massa_por_turma(
  p_import_id uuid,
  p_escola_id uuid,
  p_turma_id uuid
)
RETURNS TABLE(success_count integer, error_count integer, errors jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row record;
  v_success integer := 0;
  v_errors integer := 0;
  v_error_details jsonb := '[]'::jsonb;
  v_turma record;
  v_ano_letivo_num integer;
  v_classe_num integer;
  v_turno_codigo text;
  v_letra text;
  v_aluno_id uuid;
BEGIN
  -- Validação básica da turma
  SELECT * INTO v_turma FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  v_ano_letivo_num := v_turma.ano_letivo;
  v_classe_num := v_turma.classe_numero;
  v_turno_codigo := v_turma.turno_codigo;

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
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.id,
        'nome', v_row.nome,
        'erro', 'Aluno não encontrado (profile/BI/email)'
      ));
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.create_or_confirm_matricula(v_aluno_id, p_turma_id, v_turma.ano_letivo);
      v_success := v_success + 1;
    EXCEPTION WHEN others THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.id,
        'aluno', v_row.nome,
        'erro', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;

