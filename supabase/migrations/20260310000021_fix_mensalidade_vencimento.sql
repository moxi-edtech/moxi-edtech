BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_nova_matricula()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_ano_letivo_config record;
  v_tabela_preco record;
  v_valor_base numeric;
  v_valor_final numeric;
  v_desconto_kz numeric;
  v_dia_vencimento int;
  v_mes date;
  v_inserted_count int := 0;
  v_inserted_id uuid;
BEGIN
  -- Buscar dados da matrícula enriquecidos com curso/classe
  SELECT m.id, m.aluno_id, m.turma_id, m.ano_letivo, m.escola_id, m.percentagem_desconto, t.curso_id, t.classe_id
  INTO v_matricula
  FROM public.matriculas m
  JOIN public.turmas t ON m.turma_id = t.id
  WHERE m.id = NEW.id;

  -- Obter datas do ano letivo
  SELECT al.data_inicio, al.data_fim INTO v_ano_letivo_config
  FROM public.anos_letivos al
  WHERE al.escola_id = v_matricula.escola_id AND al.ano = v_matricula.ano_letivo;

  IF v_ano_letivo_config IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolver Tabela de Preços (Hierárquica)
  SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
  WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id = v_matricula.classe_id LIMIT 1;

  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id = v_matricula.curso_id AND classe_id IS NULL LIMIT 1;
  END IF;

  IF v_tabela_preco IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela_preco FROM public.financeiro_tabelas
    WHERE escola_id = v_matricula.escola_id AND ano_letivo = v_matricula.ano_letivo AND curso_id IS NULL AND classe_id IS NULL LIMIT 1;
  END IF;

  IF v_tabela_preco IS NULL THEN
    v_valor_base := 45000; -- Fallback
    v_dia_vencimento := 10;
  ELSE
    v_valor_base := v_tabela_preco.valor_mensalidade;
    v_dia_vencimento := coalesce(v_tabela_preco.dia_vencimento, 10);
  END IF;

  -- Calcular desconto
  v_desconto_kz := coalesce(v_valor_base * coalesce(v_matricula.percentagem_desconto, 0) / 100, 0);
  v_valor_final := v_valor_base - v_desconto_kz;

  v_mes := date_trunc('month', v_ano_letivo_config.data_inicio)::date;

  WHILE v_mes <= v_ano_letivo_config.data_fim LOOP
    INSERT INTO public.mensalidades (
      aluno_id, matricula_id, escola_id,
      valor, valor_previsto, valor_original, desconto_aplicado,
      data_vencimento, status, mes_referencia, ano_referencia
    ) VALUES (
      NEW.aluno_id, NEW.id, v_matricula.escola_id,
      v_valor_final, v_valor_final, v_valor_base, v_desconto_kz,
      make_date(extract(year from v_mes)::int, extract(month from v_mes)::int, v_dia_vencimento),
      'pendente', extract(month from v_mes)::int, extract(year from v_mes)::int
    )
    ON CONFLICT (escola_id, matricula_id, ano_referencia, mes_referencia) DO NOTHING
    RETURNING id INTO v_inserted_id;

    IF v_inserted_id IS NOT NULL THEN
      v_inserted_count := v_inserted_count + 1;
    END IF;

    v_mes := (v_mes + INTERVAL '1 month')::date;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMIT;
