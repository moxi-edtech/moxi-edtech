BEGIN;

-- A geração do carnê deve respeitar a data em que o aluno entrou no ciclo
-- financeiro. O trigger de mensalidades rejeita competências anteriores a essa
-- data; gerar o ano inteiro a partir de janeiro fazia a conversão reverter.
CREATE OR REPLACE FUNCTION financeiro.gerar_carnet_anual(p_matricula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_matricula record;
  v_turma record;
  v_data_inicio date;
  v_data_fim date;
  v_inicio_financeiro date;
  v_mes_final date;
  v_valor numeric;
  v_dia_vencimento integer;
  v_total integer := 0;
BEGIN
  SELECT
    m.id,
    m.escola_id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.status,
    m.data_inicio_financeiro,
    m.data_matricula,
    m.created_at
  INTO v_matricula
  FROM public.matriculas m
  WHERE m.id = p_matricula_id;

  IF v_matricula.id IS NULL THEN
    RAISE EXCEPTION 'Matrícula não encontrada.';
  END IF;

  SELECT
    t.curso_id,
    t.classe_id,
    t.ano_letivo_id,
    public.is_turma_classe_exame(t.id) AS is_classe_exame
  INTO v_turma
  FROM public.turmas t
  WHERE t.id = v_matricula.turma_id;

  IF v_turma.curso_id IS NULL AND v_turma.classe_id IS NULL THEN
    RAISE EXCEPTION 'Turma não encontrada para matrícula.';
  END IF;

  SELECT al.data_inicio, al.data_fim
  INTO v_data_inicio, v_data_fim
  FROM public.anos_letivos al
  WHERE al.id = v_turma.ano_letivo_id
    AND al.escola_id = v_matricula.escola_id
  LIMIT 1;

  IF v_turma.ano_letivo_id IS NULL OR v_data_inicio IS NULL OR v_data_fim IS NULL THEN
    RAISE EXCEPTION
      'Calendário académico MED não configurado para a turma do ano letivo %',
      v_matricula.ano_letivo
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.anos_letivos al
    WHERE al.id = v_turma.ano_letivo_id
      AND al.ano IS DISTINCT FROM v_matricula.ano_letivo
  ) THEN
    RAISE EXCEPTION
      'Calendário académico da turma não corresponde ao ano letivo da matrícula (%)',
      v_matricula.ano_letivo
      USING ERRCODE = 'P0001';
  END IF;

  v_inicio_financeiro := coalesce(
    v_matricula.data_inicio_financeiro,
    date_trunc(
      'month',
      coalesce(v_matricula.data_matricula, v_matricula.created_at::date, v_data_inicio) - interval '1 month'
    )::date,
    v_data_inicio
  );
  v_data_inicio := greatest(v_data_inicio, v_inicio_financeiro);
  IF v_data_inicio > v_data_fim THEN
    RAISE EXCEPTION
      'Data de início financeiro (%) está depois do fim do calendário da turma (%)',
      v_inicio_financeiro,
      v_data_fim
      USING ERRCODE = 'P0001';
  END IF;
  v_mes_final := date_trunc('month', v_data_fim)::date;

  WITH regras AS (
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 1 AS prioridade
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma.curso_id
      AND ft.classe_id = v_turma.classe_id
    UNION ALL
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 2
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id = v_turma.curso_id
      AND ft.classe_id IS NULL
    UNION ALL
    SELECT ft.valor_mensalidade, ft.dia_vencimento, 3
    FROM public.financeiro_tabelas ft
    WHERE ft.escola_id = v_matricula.escola_id
      AND ft.ano_letivo = v_matricula.ano_letivo
      AND ft.curso_id IS NULL
      AND ft.classe_id IS NULL
  ), escolhida AS (
    SELECT valor_mensalidade, dia_vencimento
    FROM regras
    ORDER BY prioridade
    LIMIT 1
  )
  SELECT coalesce(valor_mensalidade, 0), coalesce(dia_vencimento, 10)
  INTO v_valor, v_dia_vencimento
  FROM escolhida;

  WITH meses AS (
    SELECT
      extract(month FROM gs)::int AS mes_referencia,
      extract(year FROM gs)::int AS ano_referencia
    FROM generate_series(
      date_trunc('month', v_data_inicio)::date,
      date_trunc('month', v_data_fim)::date,
      interval '1 month'
    ) gs
    WHERE v_turma.is_classe_exame OR date_trunc('month', gs)::date < v_mes_final
  ), inseridos AS (
    INSERT INTO public.mensalidades (
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      mes_referencia,
      ano_referencia,
      valor,
      valor_previsto,
      valor_pago_total,
      status,
      data_vencimento,
      matricula_id
    )
    SELECT
      v_matricula.escola_id,
      v_matricula.aluno_id,
      v_matricula.turma_id,
      v_matricula.ano_letivo::text,
      m.mes_referencia,
      m.ano_referencia,
      v_valor,
      v_valor,
      0,
      'pendente',
      make_date(
        m.ano_referencia,
        m.mes_referencia,
        least(greatest(coalesce(v_dia_vencimento, 10), 1), 28)
      ),
      v_matricula.id
    FROM meses m
    ON CONFLICT (escola_id, matricula_id, ano_referencia, mes_referencia) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_total FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'mensalidades', v_total,
    'mes_inicio_cobrado', date_trunc('month', v_data_inicio)::date,
    'is_classe_exame', v_turma.is_classe_exame,
    'mes_final_cobrado', v_turma.is_classe_exame
  );
END;
$$;

-- Matrículas novas recebem a primeira competência financeira de forma
-- determinística. Uma data já definida pela secretaria é sempre preservada.
CREATE OR REPLACE FUNCTION public.set_matricula_financial_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_calendario_inicio date;
  v_data_entrada date;
BEGIN
  IF NEW.data_inicio_financeiro IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT al.data_inicio
  INTO v_calendario_inicio
  FROM public.turmas t
  LEFT JOIN public.anos_letivos al
    ON al.id = t.ano_letivo_id
  WHERE t.id = NEW.turma_id
    AND t.escola_id = NEW.escola_id;

  IF v_calendario_inicio IS NULL THEN
    RETURN NEW;
  END IF;

  v_data_entrada := coalesce(NEW.data_matricula, current_date);
  NEW.data_inicio_financeiro := greatest(
    date_trunc('month', coalesce(v_calendario_inicio, make_date(NEW.ano_letivo, 1, 1)))::date,
    date_trunc('month', v_data_entrada - interval '1 month')::date
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_matricula_financial_start ON public.matriculas;
CREATE TRIGGER trg_set_matricula_financial_start
BEFORE INSERT OR UPDATE OF turma_id, ano_letivo, data_matricula, data_inicio_financeiro
ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.set_matricula_financial_start();

COMMIT;
