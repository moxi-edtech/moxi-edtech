-- Reforça a geração do número de matrícula para evitar conflitos mesmo quando
-- numero_login está armazenado como texto e possa quebrar ordenações lexicográficas.
-- A nova lógica calcula o maior valor numérico presente em matrículas e logins
-- (da escola e global) e usa esse piso em toda chamada, além de expor uma RPC
-- para ressincronizar o contador a partir do banco.

-- Para permitir alterar o tipo de retorno de next_matricula_number em bancos
-- que ainda usam a versão antiga, derrubamos os dependentes explicitamente e
-- os recriamos abaixo com a mesma assinatura.
DROP TRIGGER IF EXISTS trg_set_matricula_number ON public.matriculas;
DROP FUNCTION IF EXISTS public.trg_set_matricula_number();

DROP FUNCTION IF EXISTS public.matricular_em_massa_por_turma(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid);
DROP FUNCTION IF EXISTS public.create_or_confirm_matricula(uuid, uuid, integer, uuid);

DROP FUNCTION IF EXISTS public.next_matricula_number(uuid);

-- Helper: piso numérico a partir das tabelas existentes
CREATE OR REPLACE FUNCTION public.matricula_counter_floor(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor bigint := 0;
BEGIN
  v_floor := GREATEST(
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(m.numero_matricula::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
    ), 0),
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(p.numero_login::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.profiles p
      WHERE p.numero_login IS NOT NULL AND p.escola_id = p_escola_id
    ), 0),
    COALESCE((
      SELECT MAX(NULLIF(regexp_replace(p2.numero_login::text, '[^0-9]', '', 'g'), '')::bigint)
      FROM public.profiles p2
      WHERE p2.numero_login IS NOT NULL
    ), 0)
  );

  RETURN v_floor;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.matricula_counter_floor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matricula_counter_floor(uuid) TO service_role;

-- RPC: permite ressincronizar manualmente o contador para a escola
CREATE OR REPLACE FUNCTION public.resync_matricula_counter(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
BEGIN
  INSERT INTO public.matricula_counters (escola_id, last_value, updated_at)
  VALUES (p_escola_id, v_floor, now())
  ON CONFLICT (escola_id) DO UPDATE
    SET last_value = GREATEST(v_floor, matricula_counters.last_value),
        updated_at = now()
  RETURNING last_value INTO v_floor;

  RETURN v_floor;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resync_matricula_counter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resync_matricula_counter(uuid) TO service_role;

-- next_matricula_number agora consulta o piso numérico e incrementa de forma
-- atômica, evitando repetições quando numero_login causa ordenação errada.
CREATE OR REPLACE FUNCTION public.next_matricula_number(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor bigint := public.matricula_counter_floor(p_escola_id);
  v_next bigint;
BEGIN
  INSERT INTO public.matricula_counters(escola_id, last_value, updated_at)
  VALUES (
    p_escola_id,
    GREATEST(v_floor + 1, 1),
    now()
  )
  ON CONFLICT (escola_id) DO UPDATE
    SET last_value = GREATEST(matricula_counters.last_value + 1, v_floor + 1),
        updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN v_next;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_matricula_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_matricula_number(uuid) TO service_role;

-- recria a função central para garantir dependência do novo next_matricula_number
CREATE OR REPLACE FUNCTION public.create_or_confirm_matricula(
  p_aluno_id   uuid,
  p_turma_id   uuid,
  p_ano_letivo integer,
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
  SELECT a.escola_id INTO v_escola_id
  FROM public.alunos a WHERE a.id = p_aluno_id;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não encontrado'; END IF;

  -- B) Validar Turma (se informada)
  IF p_turma_id IS NOT NULL THEN
    PERFORM 1 FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = v_escola_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Turma não pertence à escola do aluno'; END IF;
  END IF;

  -- C) Buscar Matrícula Existente (Lockando registro)
  IF p_matricula_id IS NOT NULL THEN
    SELECT m.id, m.numero_matricula INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.id = p_matricula_id AND m.escola_id = v_escola_id
    FOR UPDATE;
  ELSE
    SELECT m.id, m.numero_matricula INTO v_matricula_id, v_numero_matricula
    FROM public.matriculas m
    WHERE m.aluno_id = p_aluno_id AND m.ano_letivo = p_ano_letivo AND m.escola_id = v_escola_id
    FOR UPDATE;
  END IF;

  -- D) Lógica de Criação ou Atualização
  IF v_matricula_id IS NULL THEN
    -- CENÁRIO 1: Matrícula Nova -> Gera Número
    v_numero_matricula := public.next_matricula_number(v_escola_id);
    
    INSERT INTO public.matriculas (
      id, escola_id, aluno_id, turma_id, ano_letivo, status, numero_matricula, ativo, created_at
    ) VALUES (
      gen_random_uuid(), v_escola_id, p_aluno_id, p_turma_id, p_ano_letivo, 'ativo', v_numero_matricula, true, now()
    ) RETURNING id INTO v_matricula_id;

  ELSE
    -- CENÁRIO 2: Já existe -> Verifica se precisa de número
    IF v_numero_matricula IS NULL THEN
      v_numero_matricula := public.next_matricula_number(v_escola_id);
      
      UPDATE public.matriculas SET
        numero_matricula = v_numero_matricula,
        status = 'ativo', ativo = true,
        turma_id = COALESCE(p_turma_id, turma_id),
        updated_at = now()
      WHERE id = v_matricula_id;
    ELSE
      -- CENÁRIO 3: Já tem tudo -> Só garante status/turma
      UPDATE public.matriculas SET
        status = 'ativo', ativo = true,
        turma_id = COALESCE(p_turma_id, turma_id),
        updated_at = now()
      WHERE id = v_matricula_id;
    END IF;
  END IF;

  -- E) Sincronizar Login (Regra Moxi: Login do Aluno = Matrícula)
  UPDATE public.profiles p
  SET numero_login = v_numero_matricula
  FROM public.alunos a
  WHERE a.id = p_aluno_id
    AND p.user_id = a.profile_id
    AND p.role = 'aluno'
    AND (p.numero_login IS DISTINCT FROM v_numero_matricula);

  RETURN v_numero_matricula;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) TO service_role;

-- Função de trigger para preencher numero_matricula em inserts diretos
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

-- Função de matrícula em massa via staging
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

-- Função de matrícula em massa por turma
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

REVOKE EXECUTE ON FUNCTION public.matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.matricular_em_massa_por_turma(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.matricular_em_massa_por_turma(uuid, uuid, uuid) TO service_role;
