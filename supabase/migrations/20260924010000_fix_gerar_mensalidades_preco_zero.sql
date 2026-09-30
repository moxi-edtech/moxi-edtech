-- ============================================================================
-- KLASSE - gerar_mensalidades_lote deixa de criar cobrancas sem preco
--
-- CAUSA
--   O CTE `precos` resolve o valor mensal por cascata (curso+classe -> curso ->
--   classe -> escola) e termina no literal `0`. Quando nenhuma regra de
--   financeiro_tabelas cobre a turma, a matricula sai com valor_mensalidade = 0
--   e o INSERT criava na mesma uma linha `pendente` com valor 0,00.
--
--   Essa linha e um beco sem saida:
--     - registrar_pagamento recusa valor <= 0 ("Valor de pagamento deve ser
--       maior que zero"), logo nunca e pagavel;
--     - financeiro_validar_ordem_pagamento_mensalidade trata qualquer
--       status <> 'pago' como mes em aberto, independentemente do valor, logo
--       bloqueia todos os meses seguintes.
--   O aluno fica congelado no ano inteiro sem que nada no ecra explique porque.
--
-- AMBITO
--   Apenas a definicao de public.gerar_mensalidades_lote(uuid,int,int,int,uuid)
--   - a sobrecarga que os dois call sites do app usam (ambos passam p_turma_id).
--   Nenhum dado e lido, criado, alterado ou apagado por esta migracao.
--   As linhas a 0,00 que ja existem NAO sao tocadas: sao historico e a decisao
--   sobre elas e de negocio, nao desta migracao.
--
-- EFEITO
--   Matricula sem preco resolvido deixa de gerar cobranca. Em vez de a criar em
--   silencio, o jsonb de retorno passa a trazer `sem_preco`, com o numero de
--   matriculas que ficaram de fora - a lacuna fica visivel em vez de virar uma
--   divida impossivel de pagar.
--
-- REVERSAO
--   Ver 20260924010000_fix_gerar_mensalidades_preco_zero.rollback.sql
--   (recria a definicao anterior; nenhum dado a repor porque nenhum foi tocado)
--
-- NAO usar `supabase db push`: o schema_migrations local nao e fiavel neste
-- projecto e o push pode tentar reaplicar migracoes antigas sobre producao.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION public.gerar_mensalidades_lote(p_escola_id uuid, p_ano_letivo integer, p_mes_referencia integer, p_dia_vencimento_default integer DEFAULT 10, p_turma_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_data_vencimento date;
  v_mes smallint;
  v_ano int;
  v_inseridas int := 0;
  v_sem_preco int := 0;
  v_periodo_inicio date;
  v_periodo_fim date;
  v_mes_final date;
  v_competencia date;
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

  v_mes_final := date_trunc('month', v_periodo_fim)::date;
  v_competencia := make_date(v_ano, v_mes, 1);

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
      public.is_turma_classe_exame(t.id) AS is_classe_exame,
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
      AND (
        v_periodo_fim IS NULL
        OR v_competencia < v_mes_final
        OR public.is_turma_classe_exame(t.id)
      )
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
    WHERE coalesce(p.valor_mensalidade, 0) > 0
      AND NOT EXISTS (
      SELECT 1 FROM public.mensalidades m2
      WHERE m2.escola_id = p_escola_id
        AND m2.aluno_id = p.aluno_id
        AND m2.ano_referencia = v_ano
        AND m2.mes_referencia = v_mes
    )
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM inseridos),
         (SELECT count(*) FROM precos p WHERE coalesce(p.valor_mensalidade, 0) <= 0)
    INTO v_inseridas, v_sem_preco;

  RETURN jsonb_build_object(
    'ok', true,
    'geradas', coalesce(v_inseridas, 0),
    'sem_preco', coalesce(v_sem_preco, 0),
    'ano', v_ano,
    'mes', v_mes,
    'vencimento', v_data_vencimento,
    'mes_final', v_mes_final
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END;
$function$;

-- --------------------------------------------------------------- VERIFICACAO --
DO $verif$
DECLARE
  v_src   text;
  v_guarda int;
  v_velho  int;
  n_antes bigint;
  n_depois bigint;
  v_antes bigint;
  v_depois bigint;
  v_res   jsonb;
BEGIN
  SELECT p.prosrc INTO v_src
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'gerar_mensalidades_lote'
     AND pg_get_function_arguments(p.oid) LIKE '%p_turma_id%';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: a sobrecarga de 5 argumentos desapareceu';
  END IF;

  v_guarda := (length(v_src) - length(replace(v_src, 'coalesce(p.valor_mensalidade, 0) > 0', '')))
              / length('coalesce(p.valor_mensalidade, 0) > 0');
  IF v_guarda <> 1 THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: guarda de preco aparece % vezes (esperava 1)', v_guarda;
  END IF;

  IF position('sem_preco' IN v_src) = 0 THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: o retorno nao expoe sem_preco';
  END IF;

  -- a forma antiga era o INSERT filtrar so por NOT EXISTS, logo a primeira
  -- ocorrencia de "FROM precos p" tem de ser seguida da guarda
  v_velho := position('FROM precos p' || chr(10) || '    WHERE NOT EXISTS' IN v_src);
  IF v_velho <> 0 THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: o INSERT antigo sem guarda continua presente';
  END IF;

  -- ------------------------------------------------ CONSERVACAO (nada tocado) --
  SELECT count(*), COALESCE(sum(valor_pago_total), 0) INTO n_antes, v_antes
    FROM public.mensalidades WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726';

  -- --------------------------------- PROVA A: turma sem preco nao gera nada --
  -- 52515a97 = ACL-11a Classe-M-A. Nenhuma regra de 2026 cobre este curso+
  -- classe, logo o preco resolvido e 0. Antes desta migracao o mes 12/2026
  -- criava uma linha pendente a 0,00 e congelava o ano. A subtransacao e
  -- sempre revertida, para a prova nao deixar rasto.
  BEGIN
    v_res := public.gerar_mensalidades_lote('f406f5a7-a077-431c-b118-297224925726', 2026, 12, 10, '52515a97-5aa5-4087-9de2-a771c0fce453');
    -- A funcao engole erros e devolve ok:false; sem esta guarda o teste
    -- seguinte passaria com geradas NULL e a prova nao provava nada.
    IF (v_res->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'PROVA A FALHOU: a funcao devolveu erro: %', v_res;
    END IF;
    IF (v_res->>'geradas')::int <> 0 THEN
      RAISE EXCEPTION 'PROVA A FALHOU: gerou % cobrancas sem preco', v_res->>'geradas';
    END IF;
    IF (v_res->>'sem_preco')::int <> 1 THEN
      RAISE EXCEPTION 'PROVA A FALHOU: sem_preco = % (esperava 1)', v_res->>'sem_preco';
    END IF;
    RAISE NOTICE 'PROVA A (turma sem preco): %', v_res;
    RAISE EXCEPTION 'PROBE_A_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PROBE_A_ROLLBACK' THEN RAISE; END IF;
  END;

  -- ----------------------------- PROVA B: turma com preco continua a gerar --
  -- 501fc032 = ESG-8-M-A, 11 matriculas activas, preco 23500.00 pela regra
  -- curso+classe. Prova que a guarda nao quebrou o caminho feliz.
  BEGIN
    v_res := public.gerar_mensalidades_lote('f406f5a7-a077-431c-b118-297224925726', 2026, 12, 10, '501fc032-ec7b-478e-96c6-0d480b7e80c4');
    -- A funcao engole erros e devolve ok:false; sem esta guarda o teste
    -- seguinte passaria com geradas NULL e a prova nao provava nada.
    IF (v_res->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'PROVA B FALHOU: a funcao devolveu erro: %', v_res;
    END IF;
    IF (v_res->>'geradas')::int < 1 THEN
      RAISE EXCEPTION 'PROVA B FALHOU: turma com preco nao gerou nada (%)', v_res;
    END IF;
    IF (v_res->>'sem_preco')::int <> 0 THEN
      RAISE EXCEPTION 'PROVA B FALHOU: sem_preco = % numa turma com preco', v_res->>'sem_preco';
    END IF;
    RAISE NOTICE 'PROVA B (turma com preco): %', v_res;
    RAISE EXCEPTION 'PROBE_B_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PROBE_B_ROLLBACK' THEN RAISE; END IF;
  END;

  SELECT count(*), COALESCE(sum(valor_pago_total), 0) INTO n_depois, v_depois
    FROM public.mensalidades WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726';
  IF n_depois <> n_antes THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: mensalidades % -> % (as provas deixaram rasto)', n_antes, n_depois;
  END IF;
  IF v_depois IS DISTINCT FROM v_antes THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: a soma de valor_pago_total mudou';
  END IF;

  RAISE NOTICE 'Verificacao passou: guarda de preco activa, provas A e B conformes, mensalidades intactas (%).', n_depois;
END $verif$;

COMMIT;

-- -------------------------------------- POS-COMMIT: a definicao ficou gravada --
DO $pos$
DECLARE v_guarda int;
BEGIN
  SELECT (length(p.prosrc) - length(replace(p.prosrc, 'coalesce(p.valor_mensalidade, 0) > 0', '')))
         / length('coalesce(p.valor_mensalidade, 0) > 0')
    INTO v_guarda
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'gerar_mensalidades_lote'
     AND pg_get_function_arguments(p.oid) LIKE '%p_turma_id%';
  IF v_guarda <> 1 THEN
    RAISE EXCEPTION 'POS-COMMIT FALHOU: a guarda nao ficou gravada';
  END IF;
  RAISE NOTICE 'Pos-commit: public.gerar_mensalidades_lote(uuid,int,int,int,uuid) tem a guarda de preco.';
END $pos$;
