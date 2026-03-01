BEGIN;

-- Redefinir a função para incluir p_is_isento
CREATE OR REPLACE FUNCTION public.lancar_notas_batch(
  p_escola_id uuid,
  p_turma_id uuid,
  p_disciplina_id uuid,
  p_turma_disciplina_id uuid,
  p_trimestre integer,
  p_tipo_avaliacao text,
  p_notas jsonb,
  p_is_isento boolean DEFAULT false -- NOVO PARÂMETRO
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_avaliacao_id uuid;
  v_ano_letivo int;
  v_periodo_letivo_id uuid;
  v_matricula_id uuid;
  v_rows_to_upsert jsonb[] := '{}';
  nota_record jsonb;
  v_inserted_count bigint;
  v_updated_count bigint;
  v_portal text := 'secretaria';
BEGIN
  -- 1. Resolver Contexto Acadêmico
  SELECT ano_letivo INTO v_ano_letivo FROM public.turmas WHERE id = p_turma_id;
  
  SELECT id INTO v_periodo_letivo_id 
  FROM public.periodos_letivos 
  WHERE escola_id = p_escola_id AND numero = p_trimestre AND ativo IS TRUE
  LIMIT 1;

  -- 2. Garantir que a Avaliação exista
  INSERT INTO public.avaliacoes (escola_id, turma_disciplina_id, periodo_letivo_id, ano_letivo, trimestre, nome, tipo, peso, nota_max)
  VALUES (p_escola_id, p_turma_disciplina_id, v_periodo_letivo_id, v_ano_letivo, p_trimestre, p_tipo_avaliacao, p_tipo_avaliacao, 1, 20)
  ON CONFLICT (escola_id, turma_disciplina_id, ano_letivo, trimestre, tipo) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_avaliacao_id;

  -- 3. Preparar UPSERT
  FOR nota_record IN SELECT * FROM jsonb_array_elements(p_notas) LOOP
    SELECT m.id INTO v_matricula_id
    FROM public.matriculas m
    WHERE m.escola_id = p_escola_id
      AND m.turma_id = p_turma_id
      AND m.aluno_id = (nota_record->>'aluno_id')::uuid
      AND m.ano_letivo = v_ano_letivo;

    IF v_matricula_id IS NOT NULL THEN
      v_rows_to_upsert := array_append(v_rows_to_upsert, jsonb_build_object(
        'escola_id', p_escola_id,
        'avaliacao_id', v_avaliacao_id,
        'matricula_id', v_matricula_id,
        'valor', (nota_record->>'valor')::numeric,
        'is_isento', COALESCE(p_is_isento, false)
      ));
    END IF;
  END LOOP;

  -- 4. Executar UPSERT
  WITH upserted AS (
    INSERT INTO public.notas (escola_id, avaliacao_id, matricula_id, valor, is_isento)
    SELECT 
      (value->>'escola_id')::uuid,
      (value->>'avaliacao_id')::uuid,
      (value->>'matricula_id')::uuid,
      (value->>'valor')::numeric,
      (value->>'is_isento')::boolean
    FROM unnest(v_rows_to_upsert) as value
    ON CONFLICT (escola_id, matricula_id, avaliacao_id) DO UPDATE 
      SET valor = EXCLUDED.valor,
          is_isento = EXCLUDED.is_isento,
          updated_at = now()
    RETURNING xmax
  )
  SELECT 
    count(*) FILTER (WHERE xmax = 0),
    count(*) FILTER (WHERE xmax::text::int > 0)
  INTO v_inserted_count, v_updated_count
  FROM upserted;

  -- 5. Auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
  VALUES (p_escola_id, v_actor_id, 'NOTA_LANCADA_BATCH', 'notas', v_avaliacao_id::text, v_portal, 
    jsonb_build_object(
      'is_isento', p_is_isento,
      'trimestre', p_trimestre,
      'tipo', p_tipo_avaliacao,
      'turma_id', p_turma_id,
      'inserted', v_inserted_count,
      'updated', v_updated_count
    )
  );

  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted_count, 'updated', v_updated_count);
END;
$$;

COMMIT;
