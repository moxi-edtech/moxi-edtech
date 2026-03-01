BEGIN;

-- 1. Evolução da Tabela Matriculas
ALTER TABLE public.matriculas 
  ADD COLUMN IF NOT EXISTS percentagem_desconto numeric(5,2) DEFAULT 0 CHECK (percentagem_desconto >= 0 AND percentagem_desconto <= 100),
  ADD COLUMN IF NOT EXISTS motivo_desconto text;

-- 2. Evolução da Tabela Mensalidades (para transparência)
ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS valor_original numeric(12,2),
  ADD COLUMN IF NOT EXISTS desconto_aplicado numeric(12,2) DEFAULT 0;

-- 3. Atualização do Gatilho de Mensalidades
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
    v_dia_vencimento := v_tabela_preco.dia_vencimento;
  END IF;

  -- APLICAR DESCONTO (O CÉREBRO)
  v_valor_final := v_valor_base * (1 - (COALESCE(v_matricula.percentagem_desconto, 0) / 100));
  v_desconto_kz := v_valor_base - v_valor_final;

  -- Gerar Mensalidades para o resto do ano
  FOR v_mes IN
    SELECT date_trunc('month', d)::date
    FROM generate_series(v_ano_letivo_config.data_inicio, v_ano_letivo_config.data_fim, '1 month'::interval) d
  LOOP
    -- Apenas gera se o mês for igual ou superior ao mês da matrícula
    IF v_mes >= date_trunc('month', NEW.created_at) THEN
      v_inserted_id := NULL;
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
    END IF;
  END LOOP;

  -- Log de Auditoria
  IF v_inserted_count > 0 THEN
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
      v_matricula.escola_id, auth.uid(), 'MENSALIDADES_GERADAS', 'matriculas', NEW.id::text, 'system',
      jsonb_build_object(
        'mensalidades_criadas', v_inserted_count,
        'valor_base', v_valor_base,
        'valor_final', v_valor_final,
        'percentagem_desconto', v_matricula.percentagem_desconto
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
