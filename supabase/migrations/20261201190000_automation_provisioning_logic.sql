BEGIN;

/**
 * PROVISIONAMENTO AUTOMÁTICO DE ESCOLA
 * Transforma um onboarding_request em uma estrutura real de escola.
 */
CREATE OR REPLACE FUNCTION public.provisionar_escola_from_onboarding(
  p_request_id uuid,
  p_escola_id uuid -- A escola já deve ter sido criada pela API base
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req record;
  v_ano_letivo_id uuid;
  v_classe record;
  v_classe_id uuid;
  v_turno text;
  v_classe_slug text;
  v_turma_count int;
  v_turma_index int;
  v_turma_letra text;
  v_inserted_classes int := 0;
  v_inserted_turmas int := 0;
BEGIN
  -- 1. Carregar o pedido
  SELECT * INTO v_req FROM public.onboarding_requests WHERE id = p_request_id;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Pedido de onboarding não encontrado.';
  END IF;

  -- 2. Criar o Ano Letivo
  INSERT INTO public.anos_letivos (escola_id, ano, nome, data_inicio, data_fim, ativo)
  VALUES (
    p_escola_id, 
    v_req.ano_letivo::int, 
    'Ano Letivo ' || v_req.ano_letivo,
    (v_req.ano_letivo || '-02-01')::date, -- Datas padrão simplificadas
    (v_req.ano_letivo || '-12-15')::date,
    true
  )
  ON CONFLICT (escola_id, ano) DO UPDATE SET ativo = true
  RETURNING id INTO v_ano_letivo_id;

  -- 3. Criar Classes e Tabela de Preços
  FOR v_classe IN SELECT * FROM jsonb_to_recordset(v_req.classes) AS x(id text, nome text, nivel text, activa boolean, propina numeric)
  LOOP
    IF v_classe.activa THEN
      INSERT INTO public.classes (escola_id, nome, nivel, activa)
      VALUES (p_escola_id, v_classe.nome, v_classe.nivel, true)
      ON CONFLICT (escola_id, nome) DO UPDATE SET activa = true
      RETURNING id INTO v_classe_id;

      v_inserted_classes := v_inserted_classes + 1;

      -- Configurar Preço (Financeiro)
      INSERT INTO public.financeiro_tabelas (escola_id, ano_letivo, classe_id, valor_mensalidade, dia_vencimento)
      VALUES (p_escola_id, v_req.ano_letivo::int, v_classe_id, v_classe.propina, 10)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- 4. Criar Turmas (Turnos x Classes)
  -- Formato esperado no JSON: { "M": { "1": 2, "2": 1 } } -> Turno M, Classe ID "1" tem 2 turmas.
  FOR v_turno IN SELECT jsonb_object_keys(v_req.turmas)
  LOOP
    FOR v_classe_slug, v_turma_count IN SELECT * FROM jsonb_each_text(v_req.turmas->v_turno)
    LOOP
      -- Localizar o ID real da classe criada no passo anterior (pelo nome/slug mapeado)
      SELECT id INTO v_classe_id FROM public.classes 
      WHERE escola_id = p_escola_id AND (
        (v_classe_slug = 'ini' AND nome = 'Iniciação') OR
        (nome = v_classe_slug || 'ª Classe')
      ) LIMIT 1;

      IF v_classe_id IS NOT NULL THEN
        FOR v_turma_index IN 1..v_turma_count::int
        LOOP
          v_turma_letra := CHR(64 + v_turma_index); -- 1=A, 2=B...
          
          INSERT INTO public.turmas (
            escola_id, nome, curso_id, classe_id, ano_letivo, turno, status_fecho
          ) VALUES (
            p_escola_id,
            v_classe_slug || 'ª ' || v_turno || '-' || v_turma_letra,
            null, -- Por agora sem curso especializado (EP/ESG base)
            v_classe_id,
            v_req.ano_letivo::int,
            v_turno,
            'ABERTO'
          ) ON CONFLICT DO NOTHING;
          
          v_inserted_turmas := v_inserted_turmas + 1;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- 5. Atualizar Pedido
  UPDATE public.onboarding_requests 
  SET status = 'activo', escola_id = p_escola_id, updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true,
    'classes_criadas', v_inserted_classes,
    'turmas_criadas', v_inserted_turmas,
    'ano_letivo_id', v_ano_letivo_id
  );
END;
$$;

COMMIT;
