BEGIN;

-- =========================================================
-- PASSO 1: CRIAR A FUNÇÃO RPC PARA GERAR TURMAS E TURMA_DISCIPLINAS (ATÔMICO E AUDITADO)
-- =========================================================

CREATE OR REPLACE FUNCTION public.gerar_turmas_from_curriculo(
  p_escola_id uuid,
  p_curso_id uuid,
  p_ano_letivo integer,
  p_generation_params jsonb
)
RETURNS TABLE (
  turma_id uuid,
  turma_nome text,
  disciplinas_criadas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_letivo_id uuid;
  v_published_curriculo_id uuid;
  v_turma_data jsonb;
  v_turma_id uuid;
  v_new_turmas_count integer := 0;
  v_new_turma_disciplinas_count integer := 0;
  v_actor_id uuid := auth.uid();
  v_generated_turmas jsonb[] := '{}';
  v_turno text;
  
  -- Para gerar nomes de turmas
  letters text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  v_turma_letter text;
  v_turma_nome_final text;
  v_quantidade int;
  v_capacidade_maxima int := (p_generation_params->>'capacidadeMaxima')::int;
  v_curso_matriz_item record;

BEGIN
  -- 0. Validar e obter ano_letivo_id
  SELECT id INTO v_ano_letivo_id
  FROM public.anos_letivos
  WHERE escola_id = p_escola_id AND ano = p_ano_letivo
  LIMIT 1;

  IF v_ano_letivo_id IS NULL THEN
    RAISE EXCEPTION 'Ano letivo % não encontrado para a escola %.', p_ano_letivo, p_escola_id;
  END IF;

  -- 1. Encontrar o currículo publicado para o curso/ano letivo
  SELECT id INTO v_published_curriculo_id
  FROM public.curso_curriculos
  WHERE escola_id = p_escola_id
    AND curso_id = p_curso_id
    AND ano_letivo_id = v_ano_letivo_id
    AND status = 'published'
  LIMIT 1;

  IF v_published_curriculo_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum currículo publicado encontrado para o Curso % no Ano Letivo %.', p_curso_id, p_ano_letivo;
  END IF;

  -- 2. Gerar e inserir Turmas
  IF p_generation_params->'turmas' IS NOT NULL AND jsonb_array_length(p_generation_params->'turmas') > 0 THEN
    FOR v_turma_data IN SELECT jsonb_array_elements(p_generation_params->'turmas') LOOP
      v_quantidade := COALESCE((v_turma_data->>'quantidade')::int, 1);
      FOR i IN 1..v_quantidade LOOP
        v_turma_letter := letters[i];
        v_turma_nome_final := (v_turma_data->>'nome')::text || ' ' || v_turma_letter; -- Ex: 10ª Classe A

        INSERT INTO public.turmas (
          escola_id,
          curso_id,
          classe_id,
          ano_letivo,
          ano_letivo_id,
          nome,
          turno,
          capacidade_maxima,
          status_validacao
        )
        VALUES (
          p_escola_id,
          p_curso_id,
          (v_turma_data->>'classeId')::uuid,
          p_ano_letivo,
          v_ano_letivo_id,
          v_turma_nome_final,
          (v_turma_data->>'turno')::text,
          COALESCE(v_capacidade_maxima, 35),
          'ativo'
        )
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING -- Evitar duplicação em re-runs
        RETURNING id, nome INTO v_turma_id, turma_nome;
        
        IF v_turma_id IS NOT NULL THEN
          v_new_turmas_count := v_new_turmas_count + 1;
          -- 3. Gerar e inserir Turma_Disciplinas para a nova turma
          FOR v_curso_matriz_item IN
            SELECT cm.disciplina_id, cm.classe_id, cm.carga_horaria_semanal, cm.modelo_avaliacao
            FROM public.curso_matriz cm
            WHERE cm.escola_id = p_escola_id
              AND cm.curso_curriculo_id = v_published_curriculo_id
              AND cm.classe_id = (v_turma_data->>'classeId')::uuid
          LOOP
            INSERT INTO public.turma_disciplinas (
              escola_id,
              turma_id,
              disciplina_id,
              classe_id,
              ano_letivo_id,
              carga_horaria_semanal,
              modelo_avaliacao
            )
            VALUES (
              p_escola_id,
              v_turma_id,
              v_curso_matriz_item.disciplina_id,
              v_curso_matriz_item.classe_id,
              v_ano_letivo_id,
              v_curso_matriz_item.carga_horaria_semanal,
              v_curso_matriz_item.modelo_avaliacao
            )
            ON CONFLICT (turma_id, disciplina_id) DO NOTHING; -- Evitar duplicação
            v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
          END LOOP;
          v_generated_turmas := array_append(v_generated_turmas, jsonb_build_object('id', v_turma_id, 'nome', turma_nome, 'disciplinas_count', v_new_turma_disciplinas_count));
        END IF;
      END LOOP;
    END LOOP;

  ELSE -- Logica alternativa para classes e turnos (se 'turmas' array não for usado)
    -- Isso é para cobrir a lógica do front-end que tem 'classes' e 'turnos' separados
    IF p_generation_params->'classes' IS NOT NULL AND jsonb_array_length(p_generation_params->'classes') > 0 AND
       p_generation_params->'turnos' IS NOT NULL AND jsonb_array_length(p_generation_params->'turnos') > 0 THEN
      
      FOR v_turma_data IN SELECT jsonb_array_elements(p_generation_params->'classes') LOOP
        FOR v_turno IN SELECT jsonb_array_elements_text(p_generation_params->'turnos') LOOP
          v_quantidade := COALESCE((v_turma_data->>'quantidade')::int, 1);
          FOR i IN 1..v_quantidade LOOP
            v_turma_letter := letters[i];
            -- Ex: 10ª Classe M - A (Classe + Turno + Letra)
            v_turma_nome_final := (v_turma_data->>'nome')::text || ' ' || v_turno || ' - ' || v_turma_letter; 

            INSERT INTO public.turmas (
              escola_id,
              curso_id,
              classe_id,
              ano_letivo,
              ano_letivo_id,
              nome,
              turno,
              capacidade_maxima,
              status_validacao
            )
            VALUES (
              p_escola_id,
              p_curso_id,
              (v_turma_data->>'classeId')::uuid,
              p_ano_letivo,
              v_ano_letivo_id,
              v_turma_nome_final,
              v_turno::text,
              COALESCE(v_capacidade_maxima, 35),
              'ativo'
            )
            ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING -- Evitar duplicação em re-runs
            RETURNING id, nome INTO v_turma_id, turma_nome;
            
            IF v_turma_id IS NOT NULL THEN
              v_new_turmas_count := v_new_turmas_count + 1;
              -- 3. Gerar e inserir Turma_Disciplinas para a nova turma
              FOR v_curso_matriz_item IN
                SELECT cm.disciplina_id, cm.classe_id, cm.carga_horaria_semanal, cm.modelo_avaliacao
                FROM public.curso_matriz cm
                WHERE cm.escola_id = p_escola_id
                  AND cm.curso_curriculo_id = v_published_curriculo_id
                  AND cm.classe_id = (v_turma_data->>'classeId')::uuid
              LOOP
                INSERT INTO public.turma_disciplinas (
                  escola_id,
                  turma_id,
                  disciplina_id,
                  classe_id,
                  ano_letivo_id,
                  carga_horaria_semanal,
                  modelo_avaliacao
                )
                VALUES (
                  p_escola_id,
                  v_turma_id,
                  v_curso_matriz_item.disciplina_id,
                  v_curso_matriz_item.classe_id,
                  v_ano_letivo_id,
                  v_curso_matriz_item.carga_horaria_semanal,
                  v_curso_matriz_item.modelo_avaliacao
                )
                ON CONFLICT (turma_id, disciplina_id) DO NOTHING; -- Evitar duplicação
                v_new_turma_disciplinas_count := v_new_turma_disciplinas_count + 1;
              END LOOP;
              v_generated_turmas := array_append(v_generated_turmas, jsonb_build_object('id', v_turma_id, 'nome', turma_nome, 'disciplinas_count', v_new_turma_disciplinas_count));
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  IF v_new_turmas_count = 0 THEN
    RAISE EXCEPTION 'Nenhuma turma foi gerada. Verifique os parâmetros de entrada.';
  END IF;

  -- 4. Criar trilha de auditoria
  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, before, after, portal, details)
  VALUES (
    p_escola_id,
    v_actor_id,
    'TURMAS_GERADAS_FROM_CURRICULO',
    'turmas',
    null, -- Operação em massa, sem um único entity_id
    null, -- Não há estado 'before' fácil para a criação em massa
    jsonb_build_object('turmas_geradas', v_generated_turmas),
    'admin',
    jsonb_build_object(
      'curso_id', p_curso_id,
      'ano_letivo', p_ano_letivo,
      'turmas_count', v_new_turmas_count,
      'turma_disciplinas_count', v_new_turma_disciplinas_count,
      'generation_params', p_generation_params
    )
  );

  RETURN QUERY SELECT * FROM (
    SELECT 
      (elem->>'id')::uuid as turma_id, 
      (elem->>'nome')::text as turma_nome, 
      (elem->>'disciplinas_count')::integer as disciplinas_criadas
    FROM jsonb_array_elements(jsonb_build_array(v_generated_turmas)) AS elem
  ) AS subquery;

END;
$$;

ALTER FUNCTION public.gerar_turmas_from_curriculo(uuid, uuid, integer, jsonb) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.gerar_turmas_from_curriculo(uuid, uuid, integer, jsonb) TO authenticated;

COMMIT;
