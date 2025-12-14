-- =================================================================
-- PASSO 0: CORREÇÃO DE SCHEMA (CRIAR COLUNA FALTANTE)
-- =================================================================

-- Adiciona a coluna ano_letivo se ela não existir
ALTER TABLE public.matriculas
ADD COLUMN IF NOT EXISTS ano_letivo INTEGER;

-- Antes de alterar o tipo, remove o trigger que depende de numero_matricula
DROP TRIGGER IF EXISTS trg_activate_aluno_after_matricula ON public.matriculas;

-- Converte numero_matricula para bigint (sequência pura por escola)
ALTER TABLE public.matriculas
  ALTER COLUMN numero_matricula TYPE bigint USING NULLIF(regexp_replace(numero_matricula::text, '[^0-9]', '', 'g'), '')::bigint;

-- BACKFILL: Preenche o ano_letivo para matrículas antigas baseado na data de criação.
-- Isso é vital para que os índices e a lógica funcionem com dados legados.
UPDATE public.matriculas
SET ano_letivo = EXTRACT(YEAR FROM created_at)::INTEGER
WHERE ano_letivo IS NULL;

-- Recria o trigger de ativação após a alteração de tipo
CREATE TRIGGER trg_activate_aluno_after_matricula
AFTER INSERT OR UPDATE OF numero_matricula, status ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.activate_aluno_after_matricula();

-- (Opcional) Se quiser garantir que nunca seja nulo no futuro:
-- ALTER TABLE public.matriculas ALTER COLUMN ano_letivo SET NOT NULL;

-- =================================================================
-- PASSO 1: ESTRUTURA E INFRAESTRUTURA
-- =================================================================

-- 1.1) Tabela de Contadores (Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.matricula_counters (
  escola_id uuid PRIMARY KEY
    REFERENCES public.escolas(id) ON DELETE CASCADE,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.2) Índices de Performance e Integridade
-- Busca rápida para evitar Full Table Scan na matrícula
CREATE INDEX IF NOT EXISTS idx_matriculas_aluno_ano_escola
  ON public.matriculas (aluno_id, ano_letivo, escola_id);

-- Garante que NUNCA haverá dois alunos com o mesmo número na mesma escola
-- (Nota: Se houver dados sujos duplicados, esse índice pode falhar.
--  Se falhar, me avise que mandarei um script de limpeza antes).
CREATE UNIQUE INDEX IF NOT EXISTS uq_matriculas_escola_numero
  ON public.matriculas (escola_id, numero_matricula);

-- Garante integridade do login (perfil de aluno)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_numero_login_notnull
  ON public.profiles (numero_login)
  WHERE numero_login IS NOT NULL;

-- =================================================================
-- PASSO 2: MIGRAÇÃO / SEED (RODAR UMA VEZ)
-- Calcula o ponto de partida baseado no histórico legado
-- =================================================================

-- Ajusta o contador para começar DEPOIS do último número existente
INSERT INTO public.matricula_counters (escola_id, last_value, updated_at)
SELECT 
    escola_id, 
    -- Limpa lixo (letras) e pega o maior número existente
    COALESCE(MAX(NULLIF(regexp_replace(numero_matricula::text, '[^0-9]', '', 'g'), '')::bigint), 0),
    now()
FROM public.matriculas
WHERE numero_matricula IS NOT NULL
GROUP BY escola_id
ON CONFLICT (escola_id) DO UPDATE
SET last_value = EXCLUDED.last_value;

-- =================================================================
-- PASSO 3: FUNÇÕES OPERACIONAIS (CORE)
-- =================================================================

-- 3.1) Função Geradora (Ultra Rápida e Atômica)
CREATE OR REPLACE FUNCTION public.next_matricula_number(p_escola_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last bigint;
BEGIN
  -- Sequência isolada por escola; formatação fica no frontend
  INSERT INTO public.matricula_counters(escola_id, last_value, updated_at)
  VALUES (p_escola_id, 1, now())
  ON CONFLICT (escola_id) DO UPDATE
    SET last_value = matricula_counters.last_value + 1,
        updated_at = now()
  RETURNING last_value INTO v_last;
 
  -- Retorna apenas a sequência numérica bruta
  RETURN v_last;
END;
$$;

-- 3.2) Função Central de Matrícula (Coração do Sistema)
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

-- 3.3) Função de Importação em Massa (Wrapper)
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
  v_generated_num text;
BEGIN
  -- Valida turma
  IF NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id) THEN
    RAISE EXCEPTION 'Turma inválida para esta escola';
  END IF;

  -- Loop no Staging
  FOR v_row IN
    SELECT sa.id AS staging_id, sa.nome AS staging_nome, a.id AS aluno_id
    FROM public.staging_alunos sa
    LEFT JOIN public.alunos a ON a.escola_id = p_escola_id AND (
       (sa.profile_id IS NOT NULL AND a.profile_id = sa.profile_id) OR
       (sa.bi IS NOT NULL AND a.bi_numero = sa.bi) OR
       (sa.email IS NOT NULL AND a.email = sa.email)
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
      -- Delega tudo para a função central
      SELECT public.create_or_confirm_matricula(v_row.aluno_id, p_turma_id, p_ano_letivo)
      INTO v_generated_num;
      
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_details := v_error_details || jsonb_build_array(jsonb_build_object(
        'staging_id', v_row.staging_id, 'aluno', v_row.staging_nome, 'erro', SQLERRM
      ));
    END;
  END LOOP;

  RETURN QUERY SELECT v_success, v_errors, v_error_details;
END;
$$;

-- =================================================================
-- PASSO 4: SEGURANÇA (PERMISSÕES)
-- =================================================================
-- Remove acesso público (Hacker não roda função de admin)
REVOKE EXECUTE ON FUNCTION public.next_matricula_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid) FROM PUBLIC;

-- Concede acesso ao Backend (Service Role / Authenticated se necessário)
GRANT EXECUTE ON FUNCTION public.next_matricula_number(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_or_confirm_matricula(uuid, uuid, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.matricular_em_massa(uuid, uuid, text, integer, text, text, integer, uuid) TO service_role;
