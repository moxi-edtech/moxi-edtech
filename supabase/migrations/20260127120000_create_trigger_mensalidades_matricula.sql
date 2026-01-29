-- supabase/migrations/YYYYMMDDHHMMSS_create_trigger_mensalidades_matricula.sql
CREATE OR REPLACE FUNCTION public.gerar_mensalidades_nova_matricula()
RETURNS TRIGGER AS $$
DECLARE
  v_turma_id UUID;
  v_ano_letivo INTEGER;
  v_escola_id UUID;
  v_curso_id UUID;
  v_classe_id UUID;
  v_tabela RECORD;
  mes INTEGER;
  data_vencimento DATE;
  v_valor_mensalidade NUMERIC;
  v_dia_vencimento INTEGER;
BEGIN
  -- Pegar dados da matrícula e da turma associada
  SELECT m.turma_id, m.ano_letivo, m.escola_id, t.curso_id, t.classe_id
  INTO v_turma_id, v_ano_letivo, v_escola_id, v_curso_id, v_classe_id
  FROM public.matriculas m
  JOIN public.turmas t ON m.turma_id = t.id
  WHERE m.id = NEW.id;

  -- Buscar tabela de preços com fallback
  -- 1. Tenta com curso e classe
  SELECT valor_mensalidade, dia_vencimento INTO v_tabela
  FROM public.financeiro_tabelas
  WHERE escola_id = v_escola_id
    AND ano_letivo = v_ano_letivo
    AND curso_id = v_curso_id
    AND classe_id = v_classe_id
  LIMIT 1;

  -- 2. Tenta só com curso
  IF v_tabela IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela
    FROM public.financeiro_tabelas
    WHERE escola_id = v_escola_id
      AND ano_letivo = v_ano_letivo
      AND curso_id = v_curso_id
      AND classe_id IS NULL
    LIMIT 1;
  END IF;

  -- 3. Tenta só com classe
  IF v_tabela IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela
    FROM public.financeiro_tabelas
    WHERE escola_id = v_escola_id
      AND ano_letivo = v_ano_letivo
      AND curso_id IS NULL
      AND classe_id = v_classe_id
    LIMIT 1;
  END IF;

  -- 4. Tenta com valor geral da escola para o ano
  IF v_tabela IS NULL THEN
    SELECT valor_mensalidade, dia_vencimento INTO v_tabela
    FROM public.financeiro_tabelas
    WHERE escola_id = v_escola_id
      AND ano_letivo = v_ano_letivo
      AND curso_id IS NULL
      AND classe_id IS NULL
    LIMIT 1;
  END IF;

  -- Se ainda não encontrar, usa valores padrão e loga um aviso
  IF v_tabela IS NULL THEN
    v_valor_mensalidade := 45000;
    v_dia_vencimento := 10;
    RAISE WARNING 'Nenhuma tabela de preço encontrada para matrícula %. Usando valores padrão.', NEW.id;
  ELSE
    v_valor_mensalidade := v_tabela.valor_mensalidade;
    v_dia_vencimento := v_tabela.dia_vencimento;
  END IF;

  -- Gerar mensalidades (10 meses)
  FOR mes IN 1..10 LOOP
    data_vencimento := MAKE_DATE(v_ano_letivo, mes, v_dia_vencimento);

    -- Não gerar mensalidades retroativas à data da matrícula
    IF data_vencimento >= DATE_TRUNC('month', NEW.created_at) THEN
      INSERT INTO public.mensalidades (
        id, aluno_id, matricula_id, escola_id, valor, valor_previsto,
        data_vencimento, status, mes_referencia, ano_referencia,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), NEW.aluno_id, NEW.id, v_escola_id,
        v_valor_mensalidade, v_valor_mensalidade,
        data_vencimento, 'pendente', mes, v_ano_letivo,
        NOW(), NOW()
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para novas matrículas
DROP TRIGGER IF EXISTS tr_gerar_mensalidades_matricula ON public.matriculas;
CREATE TRIGGER tr_gerar_mensalidades_matricula
  AFTER INSERT ON public.matriculas
  FOR EACH ROW
  WHEN (NEW.status = 'ativa' OR NEW.status = 'ativo')
  EXECUTE FUNCTION public.gerar_mensalidades_nova_matricula();
