BEGIN;

-- =================================================================
-- MIGRATION: Refatoração do SSOT de Frequências
--
-- OBJETIVO:
-- 1. Garantir que `frequencias` seja a única fonte da verdade (SSOT).
-- 2. Garantir unicidade por aluno/dia/aula.
-- 3. Centralizar a lógica de escrita em uma RPC auditada.
-- =================================================================

-- PASSO 1: Descontinuar a tabela `presencas` para forçar o SSOT em `frequencias`
ALTER TABLE IF EXISTS public.presencas RENAME TO presencas_deprecated;

-- Criar uma VIEW para manter a compatibilidade com código legado que possa ler de `presencas`.
-- A VIEW faz um JOIN com `matriculas` e `aulas` para simular a estrutura antiga.
CREATE OR REPLACE VIEW public.presencas AS
SELECT
  f.id,
  f.escola_id,
  m.aluno_id,
  m.turma_id,
  f.data,
  f.status,
  cm.disciplina_id
FROM
  public.frequencias f
  JOIN public.matriculas m ON f.matricula_id = m.id
  LEFT JOIN public.aulas a ON f.aula_id = a.id
  LEFT JOIN public.turma_disciplinas td ON a.turma_disciplina_id = td.id
  LEFT JOIN public.curso_matriz cm ON td.curso_matriz_id = cm.id;

COMMENT ON VIEW public.presencas IS 'VIEW de compatibilidade sobre a tabela `frequencias`, que é o SSOT. Não usar para escrita.';


-- PASSO 2: Atualizar a chave única da tabela particionada `frequencias`
-- A função a seguir remove a constraint antiga e cria a nova em todas as partições.
DO $$
DECLARE
  parent_table_oid oid := to_regclass('public.frequencias');
  partition_name text;
BEGIN
  -- Remover a constraint antiga da tabela pai
  -- O `ONLY` garante que estamos alterando apenas a tabela pai, não as partições diretamente
  ALTER TABLE ONLY public.frequencias DROP CONSTRAINT IF EXISTS uq_frequencias_escola_matricula_data;

  -- Criar a nova constraint na tabela pai
  ALTER TABLE ONLY public.frequencias
    ADD CONSTRAINT uq_frequencias_ssot_por_aula UNIQUE (escola_id, matricula_id, data, aula_id);

  -- Iterar sobre todas as partições e aplicar as mudanças
  FOR partition_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    WHERE i.inhparent = parent_table_oid
  LOOP
    -- Remover a constraint antiga da partição
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %s;', partition_name, 'frequencias' || substr(partition_name, 11) || '_escola_id_matricula_id_data_key');

    -- Adicionar a nova constraint na partição e anexá-la à constraint da tabela pai
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (escola_id, matricula_id, data, aula_id);', partition_name, 'uq_frequencias_ssot_' || substr(partition_name, 12));
  END LOOP;
END;
$$;


-- PASSO 3: Criar a RPC `upsert_frequencias_batch`
CREATE OR REPLACE FUNCTION public.upsert_frequencias_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_data date,
  p_presencas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aula_id uuid;
  v_turma_disciplina_id uuid;
  v_periodo_letivo_id uuid;
  v_actor_id uuid := auth.uid();
  presenca_record jsonb;
  v_matricula_id uuid;
  v_status text;
  v_inserted boolean;
  v_inserted_count int := 0;
  v_updated_count int := 0;
BEGIN
  -- 1. Resolver turma_disciplina_id e período letivo
  SELECT td.id INTO v_turma_disciplina_id
  FROM public.turma_disciplinas td
  JOIN public.curso_matriz cm ON cm.id = td.curso_matriz_id
  WHERE td.escola_id = p_escola_id
    AND td.turma_id = p_turma_id
    AND cm.disciplina_id = p_disciplina_id
  ORDER BY td.created_at DESC
  LIMIT 1;

  IF v_turma_disciplina_id IS NULL THEN
    RAISE EXCEPTION 'Turma/Disciplina não encontrada para frequência';
  END IF;

  SELECT pl.id INTO v_periodo_letivo_id
  FROM public.periodos_letivos pl
  JOIN public.anos_letivos al ON al.id = pl.ano_letivo_id
  WHERE al.escola_id = p_escola_id
    AND p_data BETWEEN pl.data_inicio AND pl.data_fim
  ORDER BY pl.data_inicio DESC
  LIMIT 1;

  -- 2. Validar e encontrar a aula correspondente
  SELECT a.id INTO v_aula_id
  FROM public.aulas a
  WHERE a.escola_id = p_escola_id
    AND a.turma_disciplina_id = v_turma_disciplina_id
    AND a.data = p_data;

  IF v_aula_id IS NULL THEN
    -- Se a aula não existe, cria-a (lógica de "diário de classe")
    INSERT INTO public.aulas (escola_id, turma_disciplina_id, data, created_by)
    VALUES (p_escola_id, v_turma_disciplina_id, p_data, v_actor_id)
    RETURNING id INTO v_aula_id;
  END IF;

  -- 2. Loop e UPSERT
  FOR presenca_record IN SELECT * FROM jsonb_array_elements(p_presencas) LOOP
    v_matricula_id := (
      SELECT m.id FROM public.matriculas m
      WHERE m.escola_id = p_escola_id
        AND m.turma_id = p_turma_id
        AND m.aluno_id = (presenca_record->>'aluno_id')::uuid
        AND m.status = 'ativa'
      LIMIT 1
    );
    v_status := presenca_record->>'status';

    IF v_matricula_id IS NOT NULL THEN
      INSERT INTO public.frequencias (escola_id, matricula_id, data, aula_id, status, periodo_letivo_id)
      VALUES (p_escola_id, v_matricula_id, p_data, v_aula_id, v_status, v_periodo_letivo_id)
      ON CONFLICT (escola_id, matricula_id, data, aula_id) DO UPDATE
        SET status = EXCLUDED.status, updated_at = now()
      RETURNING (xmax = 0) INTO v_inserted;

      IF v_inserted THEN
        v_inserted_count := v_inserted_count + 1;
      ELSE
        v_updated_count := v_updated_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 3. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'FREQUENCIA_UPSERT_BATCH',
    'frequencias',
    'professor',
    jsonb_build_object(
      'aula_id', v_aula_id,
      'turma_id', p_turma_id,
      'disciplina_id', p_disciplina_id,
      'data', p_data,
      'inserted_count', v_inserted_count,
      'updated_count', v_updated_count
    )
  );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted_count, 'updated', v_updated_count);
END;
$$;

ALTER FUNCTION public.upsert_frequencias_batch(uuid, uuid, uuid, date, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.upsert_frequencias_batch(uuid, uuid, uuid, date, jsonb) TO authenticated;

COMMIT;
