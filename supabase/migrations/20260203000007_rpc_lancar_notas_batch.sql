BEGIN;

-- =================================================================
-- RPC para Lançamento de Notas em Lote (Atômico e Auditado)
--
-- Substitui a lógica que estava na API:
-- /api/professor/notas/route.ts
-- =================================================================

CREATE OR REPLACE FUNCTION public.lancar_notas_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_turma_disciplina_id uuid,
  p_trimestre int,
  p_tipo_avaliacao text,
  p_notas jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Variáveis de validação e controle
  v_actor_id uuid := auth.uid();
  v_professor_id uuid;
  v_turma record;
  v_turma_disciplina record;
  v_avaliacao_id uuid;
  v_is_professor_assigned boolean := false;
  v_ano_letivo int;

  -- Variáveis de loop e resultado
  nota_record jsonb;
  v_matricula_id uuid;
  v_inserted_count int := 0;
  v_updated_count int := 0;
  v_rows_to_upsert jsonb[] := '{}';
BEGIN
  -- 1. Validação de Permissões e Contexto
  SELECT p.id INTO v_professor_id FROM public.professores p WHERE p.profile_id = v_actor_id AND p.escola_id = p_escola_id;
  IF v_professor_id IS NULL THEN RAISE EXCEPTION 'AUTH: Professor não encontrado para este usuário.'; END IF;

  SELECT t.id, t.escola_id, t.curso_id, t.classe_id, t.ano_letivo INTO v_turma FROM public.turmas t WHERE t.id = p_turma_id AND t.escola_id = p_escola_id;
  IF v_turma.id IS NULL THEN RAISE EXCEPTION 'DATA: Turma não encontrada.'; END IF;
  v_ano_letivo := v_turma.ano_letivo;

  SELECT td.id, td.professor_id, td.curso_matriz_id INTO v_turma_disciplina FROM public.turma_disciplinas td WHERE td.id = p_turma_disciplina_id AND td.escola_id = p_escola_id;
  IF v_turma_disciplina.id IS NULL THEN RAISE EXCEPTION 'DATA: Disciplina da turma não encontrada.'; END IF;
  
  v_is_professor_assigned := v_turma_disciplina.professor_id = v_professor_id;
  IF NOT v_is_professor_assigned THEN
    SELECT true INTO v_is_professor_assigned FROM public.turma_disciplinas_professores
    WHERE escola_id = p_escola_id
      AND turma_id = p_turma_id
      AND disciplina_id = p_disciplina_id
      AND professor_id = v_professor_id;
    IF NOT v_is_professor_assigned THEN RAISE EXCEPTION 'AUTH: Professor não atribuído a esta disciplina/turma.'; END IF;
  END IF;

  -- 2. Garantir que a Avaliação exista (On-Demand)
  INSERT INTO public.avaliacoes (escola_id, turma_disciplina_id, ano_letivo, trimestre, nome, tipo, peso, nota_max)
  VALUES (p_escola_id, p_turma_disciplina_id, v_ano_letivo, p_trimestre, p_tipo_avaliacao, p_tipo_avaliacao, 1, 20)
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_avaliacao_id;

  -- 3. Preparar as linhas para o UPSERT
  FOR nota_record IN SELECT * FROM jsonb_array_elements(p_notas) LOOP
    SELECT m.id INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = (nota_record->>'aluno_id')::uuid
      AND m.ano_letivo = v_ano_letivo
      AND m.status = 'ativa';
    
    IF v_matricula_id IS NOT NULL THEN
      v_rows_to_upsert := array_append(v_rows_to_upsert, jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', (nota_record->>'valor')::numeric
      ));
    END IF;
  END LOOP;

  -- 4. Executar o UPSERT em lote
  WITH upserted AS (
    INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor)
    SELECT 
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric
    FROM unnest(v_rows_to_upsert) as value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id) DO UPDATE
      SET valor = EXCLUDED.valor, updated_at = now()
    RETURNING xmax
  )
  SELECT
    count(*) FILTER (WHERE xmax = 0),
    count(*) FILTER (WHERE xmax::text::int > 0)
  INTO v_inserted_count, v_updated_count
  FROM upserted;

  -- 5. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'NOTA_LANCADA_BATCH',
    'notas',
    v_avaliacao_id::text,
    'professor',
    jsonb_build_object(
        'turma_id', p_turma_id,
        'disciplina_id', p_disciplina_id,
        'avaliacao_id', v_avaliacao_id,
        'tipo_avaliacao', p_tipo_avaliacao,
        'trimestre', p_trimestre,
        'inserted_count', v_inserted_count,
        'updated_count', v_updated_count,
        'total_in_payload', jsonb_array_length(p_notas)
    )
  );

  RETURN jsonb_build_object('ok', true, 'avaliacao_id', v_avaliacao_id, 'inserted', v_inserted_count, 'updated', v_updated_count);

END;
$$;

ALTER FUNCTION public.lancar_notas_batch(uuid, uuid, uuid, uuid, int, text, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.lancar_notas_batch(uuid, uuid, uuid, uuid, int, text, jsonb) TO authenticated;

COMMIT;
