BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(
  p_escola_id uuid,
  p_ano_letivo integer,
  p_mes_referencia integer,
  p_dia_vencimento_default integer DEFAULT 10,
  p_turma_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
  v_periodo_inicio date;
  v_periodo_fim date;
BEGIN
  v_mes := LEAST(GREATEST(p_mes_referencia, 1), 12);

  SELECT al.data_inicio, al.data_fim
    INTO v_periodo_inicio, v_periodo_fim
  FROM public.anos_letivos al
  WHERE al.escola_id = p_escola_id
    AND al.ano = p_ano_letivo
  ORDER BY al.ativo DESC, al.created_at DESC
  LIMIT 1;

  v_ano := p_ano_letivo;
  IF v_periodo_inicio IS NOT NULL
     AND v_periodo_fim IS NOT NULL
     AND EXTRACT(YEAR FROM v_periodo_inicio) <> EXTRACT(YEAR FROM v_periodo_fim) THEN
    v_ano := CASE
      WHEN v_mes >= EXTRACT(MONTH FROM v_periodo_inicio)::int
        THEN EXTRACT(YEAR FROM v_periodo_inicio)::int
      ELSE EXTRACT(YEAR FROM v_periodo_fim)::int
    END;
  END IF;

  v_data_vencimento := make_date(
    v_ano,
    v_mes,
    LEAST(GREATEST(coalesce(p_dia_vencimento_default, 10), 1), 28)
  );

  WITH regras AS (
    SELECT
      ft.id AS tabela_id,
      ft.escola_id,
      ft.ano_letivo,
      ft.curso_id,
      ft.classe_id,
      ft.valor_mensalidade,
      ft.dia_vencimento,
      1 AS prioridade
    FROM public.financeiro_tabelas ft
    UNION ALL
    SELECT id, escola_id, ano_letivo, curso_id, NULL, valor_mensalidade, dia_vencimento, 2
    FROM public.financeiro_tabelas
    WHERE classe_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, classe_id, valor_mensalidade, dia_vencimento, 3
    FROM public.financeiro_tabelas
    WHERE curso_id IS NULL
    UNION ALL
    SELECT id, escola_id, ano_letivo, NULL, NULL, valor_mensalidade, dia_vencimento, 4
    FROM public.financeiro_tabelas
  ),
  precos AS (
    SELECT
      m.id AS matricula_id,
      m.aluno_id,
      m.turma_id,
      t.curso_id,
      t.classe_id,
      coalesce(
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT tabela_id FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1)
      ) AS tabela_id,
      coalesce(
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT valor_mensalidade FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        0
      ) AS valor_mensalidade,
      coalesce(
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id = t.curso_id
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id = t.classe_id
         ORDER BY prioridade LIMIT 1),
        (SELECT dia_vencimento FROM regras r
         WHERE r.escola_id = p_escola_id
           AND r.ano_letivo = p_ano_letivo
           AND r.curso_id IS NULL
           AND r.classe_id IS NULL
         ORDER BY prioridade LIMIT 1),
        p_dia_vencimento_default
      ) AS dia_vencimento_resolvido
    FROM public.matriculas m
    JOIN public.turmas t ON t.id = m.turma_id
    WHERE m.escola_id = p_escola_id
      AND m.ano_letivo::text = p_ano_letivo::text
      AND m.status IN ('ativo', 'ativa')
      AND (p_turma_id IS NULL OR m.turma_id = p_turma_id)
  ),
  inseridos AS (
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
      tabela_id
    )
    SELECT
      p_escola_id,
      p.aluno_id,
      p.turma_id,
      p_ano_letivo::text,
      v_mes,
      v_ano,
      p.valor_mensalidade,
      p.valor_mensalidade,
      0,
      'pendente',
      make_date(v_ano, v_mes, LEAST(GREATEST(coalesce(p.dia_vencimento_resolvido, p_dia_vencimento_default), 1), 28)),
      p.tabela_id
    FROM precos p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridas FROM inseridos;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$$;

WITH anos_cruzados AS (
  SELECT
    al.escola_id,
    al.ano AS ano_letivo,
    EXTRACT(MONTH FROM al.data_inicio)::int AS mes_inicio,
    EXTRACT(YEAR FROM al.data_inicio)::int AS ano_inicio,
    EXTRACT(YEAR FROM al.data_fim)::int AS ano_fim
  FROM public.anos_letivos al
  WHERE al.data_inicio IS NOT NULL
    AND al.data_fim IS NOT NULL
    AND EXTRACT(YEAR FROM al.data_inicio) <> EXTRACT(YEAR FROM al.data_fim)
),
correcao AS (
  SELECT
    m.id,
    CASE
      WHEN m.mes_referencia >= ac.mes_inicio THEN ac.ano_inicio
      ELSE ac.ano_fim
    END AS novo_ano_referencia
  FROM public.mensalidades m
  JOIN anos_cruzados ac
    ON ac.escola_id = m.escola_id
   AND m.ano_letivo = ac.ano_letivo::text
  WHERE m.mes_referencia IS NOT NULL
    AND m.ano_referencia IS DISTINCT FROM CASE
      WHEN m.mes_referencia >= ac.mes_inicio THEN ac.ano_inicio
      ELSE ac.ano_fim
    END
)
UPDATE public.mensalidades m
SET
  ano_referencia = c.novo_ano_referencia,
  data_vencimento = make_date(
    c.novo_ano_referencia,
    m.mes_referencia,
    LEAST(GREATEST(EXTRACT(DAY FROM COALESCE(m.data_vencimento, CURRENT_DATE))::int, 1), 28)
  ),
  updated_at = now()
FROM correcao c
WHERE m.id = c.id;

COMMIT;
