BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_nova_matricula()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_matricula record;
  v_ano_letivo_config record;
  v_tabela_preco record;
  v_valor_mensalidade numeric;
  v_dia_vencimento int;
  v_mes date;
  v_inserted_count int := 0;
  v_inserted_id uuid;
BEGIN
  SELECT m.id, m.aluno_id, m.turma_id, m.ano_letivo, m.escola_id, t.curso_id, t.classe_id
  INTO v_matricula
  FROM public.matriculas m
  JOIN public.turmas t ON m.turma_id = t.id
  WHERE m.id = NEW.id;

  SELECT al.data_inicio, al.data_fim INTO v_ano_letivo_config
  FROM public.anos_letivos al
  WHERE al.escola_id = v_matricula.escola_id AND al.ano = v_matricula.ano_letivo;

  IF v_ano_letivo_config IS NULL THEN
    RAISE WARNING 'Ano letivo % não configurado para escola %, não foi possível gerar mensalidades para matrícula %.', v_matricula.ano_letivo, v_matricula.escola_id, NEW.id;
    RETURN NEW;
  END IF;

  SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
  WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id = v_matricula.classe_id LIMIT 1;
  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id IS NULL LIMIT 1;
  END IF;
  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id IS NULL AND classe_id = v_matricula.classe_id LIMIT 1;
  END IF;
  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id IS NULL AND classe_id IS NULL LIMIT 1;
  END IF;

  IF v_tabela_preco IS NULL THEN
    v_valor_mensalidade := 45000;
    v_dia_vencimento := 10;
    RAISE WARNING 'Nenhuma tabela de preço encontrada para matrícula %. Usando valores padrão.', NEW.id;
  ELSE
    v_valor_mensalidade := v_tabela_preco.valor_mensalidade;
    v_dia_vencimento := v_tabela_preco.dia_vencimento;
  END IF;

  FOR v_mes IN
    SELECT date_trunc('month', d)::date
    FROM generate_series(v_ano_letivo_config.data_inicio, v_ano_letivo_config.data_fim, '1 month'::interval) d
  LOOP
    IF v_mes >= date_trunc('month', NEW.created_at) THEN
      v_inserted_id := NULL;
      INSERT INTO public.mensalidades (
        aluno_id, matricula_id, escola_id, valor, valor_previsto,
        data_vencimento, status, mes_referencia, ano_referencia
      ) VALUES (
        NEW.aluno_id, NEW.id, v_matricula.escola_id,
        v_valor_mensalidade, v_valor_mensalidade,
        make_date(extract(year from v_mes)::int, extract(month from v_mes)::int, v_dia_vencimento),
        'pendente', extract(month from v_mes)::int, extract(year from v_mes)::int
      )
      ON CONFLICT (escola_id, aluno_id, ano_referencia, mes_referencia) DO NOTHING
      RETURNING id INTO v_inserted_id;

      IF v_inserted_id IS NOT NULL THEN
        v_inserted_count := v_inserted_count + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_inserted_count > 0 THEN
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_matricula.escola_id,
      auth.uid(),
      'MENSALIDADES_GERADAS',
      'matriculas',
      NEW.id::text,
      'system',
      jsonb_build_object(
        'trigger', 'gerar_mensalidades_nova_matricula',
        'mensalidades_criadas', v_inserted_count,
        'valor_mensal', v_valor_mensalidade
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
