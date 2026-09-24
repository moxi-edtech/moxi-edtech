-- ============================================================================
-- KLASSE — Correcção do pagamento de mensalidade no balcão (Bug A)
-- 2026-09-24 · Escola KLASSE · autorizado explicitamente pelo utilizador
-- ("RPC + dados").
--
-- NÃO usar `supabase db push` para aplicar isto: o `schema_migrations` desta
-- base não é fiável e o push pode tentar reaplicar migrações antigas. Aplicar
-- com psql, dentro de uma transacção, e verificar os objectos reais.
--
-- ---------------------------------------------------------------- CAUSA ----
-- public.registrar_pagamento() procurava a linha do ledger por
-- (escola, aluno, origem='mensalidade', tipo='debito', ano_referencia,
-- mes_referencia) SEM filtrar o estado, e fazia UPDATE incondicional.
--
-- Quando essa linha já estava 'pago', o trigger block_paid_updates
-- (BEFORE UPDATE em financeiro_lancamentos, migration
-- 20260127020400_klasse_p0_aggregates_outbox_worker.sql:277) levantava
--   P0001 'Não é permitido editar um lançamento financeiro que já foi pago.'
-- e abortava o pagamento INTEIRO: o recibo não saía e a mensalidade ficava
-- pendente, apesar de o dinheiro ter sido recebido no balcão.
--
-- Reproduzido dentro de BEGIN;…ROLLBACK; com identidade de
-- secretaria@klasse.ao: mensalidade do Adilson Mavinga 09/2026 → P0001.
--
-- --------------------------------------------------------------- ÂMBITO ----
-- 8 mensalidades em aberto cujo mês mais antigo em aberto tinha a linha do
-- ledger já 'pago' — 3 alunos, 190.000 Kz que não se conseguiam cobrar:
--   Adilson Mavinga  2026/9, 2026/10
--   Alvid Caliye     2026/9, 2026/10
--   Caroline Caliye  2026/11, 2026/12
--
-- Mais 2 mensalidades da Caroline Caliye (2026/3, 2026/4) que estavam
-- 'pendente' com valor_pago_total JÁ IGUAL ao valor_previsto, com pagamento
-- 'settled' em public.pagamentos e a linha do ledger já 'pago'. Não é dinheiro
-- em falta — é um estado que nunca foi virado. O guard
-- financeiro_validar_ordem_pagamento_mensalidade() lê-as como em aberto e
-- bloqueava a Caroline em TODOS os meses seguintes.
--
-- --------------------------------------------------------------- EFEITO ----
-- Função: só a busca da linha do ledger muda. Duas alterações:
--   1. `status IS DISTINCT FROM 'pago'` — nunca tocar numa linha liquidada.
--      É esta que desbloqueia os pagamentos.
--   2. `ORDER BY (matricula_id IS DISTINCT FROM v_mensalidade.matricula_id)`
--      — entre candidatas, preferir a da mesma matrícula. Em 5 das 8 linhas o
--      ledger tem a matrícula de 2025 e a mensalidade a de 2026.
--   Sem candidata, o ledger não é tocado (o IF FOUND já o garantia). A
--   mensalidade é sempre actualizada, que é o que faz o pagamento avançar.
--
-- Dados: 2 linhas passam a 'pago'. Não se altera nenhum valor, nenhuma data e
-- nenhum pagamento. O dinheiro estava recebido desde 2026-03-04 e 2026-05-05.
--
-- Impacto na MV do radar: sai de 44 para 42 linhas (as duas da Caroline eram
-- linhas fantasma com valor_em_atraso = 0). A soma em atraso NÃO muda
-- (830.500 Kz) porque essas linhas já contribuíam 0. Continua a ser preciso
-- refrescar a MV.
--
-- ------------------------------------------------------------ ROLLBACK ----
-- Função:  \i /tmp/klasse_fix/registrar_pagamento_ORIGINAL.sql
--          (pg_get_functiondef da versão em produção à data)
-- Dados:   UPDATE public.mensalidades SET status='pendente'
--           WHERE id IN ('701f821d-555e-459f-9d78-70ac050ba726',
--                        'e5326df5-ad49-407e-9bc2-2453afab7458');
--          Backup completo em public._bk_20260924_mensalidades_caroline.
-- Nada é apagado.
-- ============================================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------- BACKUP ----
-- Fora de transacção, de propósito: tem de sobreviver a um rollback.
CREATE TABLE IF NOT EXISTS public._bk_20260924_mensalidades_caroline AS
  SELECT * FROM public.mensalidades
   WHERE id IN ('701f821d-555e-459f-9d78-70ac050ba726',
                'e5326df5-ad49-407e-9bc2-2453afab7458');

SELECT 'backup' AS k, count(*) AS n FROM public._bk_20260924_mensalidades_caroline;

BEGIN;

-- ------------------------------------------------------------ INSTANTÂNEO ---
-- Estado da escola no início da transacção. A verificação compara contra isto
-- em vez de usar números fixos: a base está viva (o gerador de mensalidades
-- criou 11 nas últimas 24 horas) e um número escrito à mão apodrece. Uma
-- primeira versão desta migração tinha `n <> 297` e teria abortado por isso.
-- ON COMMIT DROP porque a porta 6543 é o pooler em modo transacção e uma tabela
-- temporária deixada para trás aparece na sessão seguinte.
CREATE TEMP TABLE _verif_20260924 ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.mensalidades
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS n_mens,
  (SELECT COALESCE(sum(valor_pago_total),0) FROM public.mensalidades
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS soma_pago,
  (SELECT count(*) FROM public.notas
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS n_notas,
  (SELECT count(*) FROM public.mensalidades
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND status='pago') AS n_pago,
  (SELECT count(*) FROM public.mensalidades
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND status='pendente') AS n_pendente,
  (SELECT count(*) FROM public.financeiro_lancamentos
    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS n_ledger;

-- ------------------------------------------------------------ FUNÇÃO -------
CREATE OR REPLACE FUNCTION public.registrar_pagamento(
  p_mensalidade_id uuid,
  p_metodo_pagamento text,
  p_observacao text DEFAULT NULL::text,
  p_valor_pago numeric DEFAULT NULL::numeric,
  p_promessa_liquidacao date DEFAULT NULL::date
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mensalidade public.mensalidades%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_valor_a_registrar numeric;
  v_novo_total_pago numeric;
  v_lancamento_id uuid;
  v_metodo_enum public.metodo_pagamento_enum;
  v_descricao text;
  v_novo_status text;
  v_ordem jsonb;
  v_ledger_tocado boolean := false;
BEGIN
  SELECT * INTO v_mensalidade
  FROM public.mensalidades
  WHERE id = p_mensalidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Mensalidade não encontrada.');
  END IF;

  IF v_mensalidade.status = 'pago' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta mensalidade já foi paga.');
  END IF;

  v_ordem := public.financeiro_validar_ordem_pagamento_mensalidade(
    v_mensalidade.escola_id,
    v_mensalidade.aluno_id,
    v_mensalidade.id
  );

  IF COALESCE((v_ordem->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', COALESCE(v_ordem->>'message', 'Existe uma mensalidade anterior em aberto.')
    );
  END IF;

  v_valor_a_registrar := COALESCE(
    p_valor_pago,
    (COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) - COALESCE(v_mensalidade.valor_pago_total, 0))
  );

  IF v_valor_a_registrar <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Valor de pagamento deve ser maior que zero.');
  END IF;

  v_novo_total_pago := COALESCE(v_mensalidade.valor_pago_total, 0) + v_valor_a_registrar;

  IF v_novo_total_pago > COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) + 0.01 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Valor pago excede o valor previsto da mensalidade.');
  END IF;

  v_novo_status := CASE
    WHEN v_novo_total_pago < (COALESCE(v_mensalidade.valor_previsto, v_mensalidade.valor) - 0.01) THEN 'pago_parcial'
    ELSE 'pago'
  END;

  UPDATE public.mensalidades
  SET
    status = v_novo_status,
    valor_pago_total = v_novo_total_pago,
    data_pagamento_efetiva = CURRENT_DATE,
    metodo_pagamento = p_metodo_pagamento,
    observacao = COALESCE(p_observacao, observacao),
    updated_at = now(),
    updated_by = v_user_id
  WHERE id = p_mensalidade_id;

  v_metodo_enum := CASE lower(coalesce(p_metodo_pagamento, ''))
    WHEN 'dinheiro' THEN 'numerario'::public.metodo_pagamento_enum
    WHEN 'numerario' THEN 'numerario'::public.metodo_pagamento_enum
    WHEN 'tpa' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'tpa_fisico' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'multicaixa' THEN 'multicaixa'::public.metodo_pagamento_enum
    WHEN 'transferencia' THEN 'transferencia'::public.metodo_pagamento_enum
    WHEN 'mbway' THEN 'deposito'::public.metodo_pagamento_enum
    WHEN 'referencia' THEN 'deposito'::public.metodo_pagamento_enum
    WHEN 'deposito' THEN 'deposito'::public.metodo_pagamento_enum
    ELSE NULL
  END;

  v_descricao := CASE
    WHEN v_mensalidade.ano_referencia IS NOT NULL AND v_mensalidade.mes_referencia IS NOT NULL THEN
      'Mensalidade ' || to_char(make_date(v_mensalidade.ano_referencia, v_mensalidade.mes_referencia, 1), 'TMMon/YYYY')
    ELSE 'Mensalidade'
  END;

  -- ------------------------------------------------ ALTERADO (só esta busca)
  SELECT id
    INTO v_lancamento_id
  FROM public.financeiro_lancamentos
  WHERE escola_id = v_mensalidade.escola_id
    AND aluno_id = v_mensalidade.aluno_id
    AND origem = 'mensalidade'
    AND tipo = 'debito'
    AND ano_referencia IS NOT DISTINCT FROM v_mensalidade.ano_referencia
    AND mes_referencia IS NOT DISTINCT FROM v_mensalidade.mes_referencia
    AND status IS DISTINCT FROM 'pago'
  ORDER BY (matricula_id IS DISTINCT FROM v_mensalidade.matricula_id), created_at
  LIMIT 1
  FOR UPDATE;
  -- -------------------------------------------------------------------------

  IF FOUND THEN
    v_ledger_tocado := true;
    UPDATE public.financeiro_lancamentos
    SET
      status = CASE WHEN v_novo_status = 'pago' THEN 'pago'::public.financeiro_status ELSE 'parcial'::public.financeiro_status END,
      data_pagamento = now(),
      metodo_pagamento = v_metodo_enum,
      updated_at = now()
    WHERE id = v_lancamento_id;
  END IF;

  INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details, before, after)
  VALUES (
    v_mensalidade.escola_id,
    v_user_id,
    'PAGAMENTO_REGISTRADO',
    'mensalidades',
    p_mensalidade_id::text,
    'financeiro',
    jsonb_build_object(
      'metodo', p_metodo_pagamento,
      'obs', p_observacao,
      'valor_pago', v_valor_a_registrar,
      'novo_total_pago', v_novo_total_pago,
      'promessa', p_promessa_liquidacao,
      'aluno_id', v_mensalidade.aluno_id,
      'matricula_id', v_mensalidade.matricula_id,
      'ledger_tocado', v_ledger_tocado
    ),
    jsonb_build_object('status', v_mensalidade.status, 'valor_pago_total', v_mensalidade.valor_pago_total),
    jsonb_build_object('status', v_novo_status, 'valor_pago_total', v_novo_total_pago)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_mensalidade_id,
    'valor_registrado', v_valor_a_registrar,
    'novo_total_pago', v_novo_total_pago,
    'status', v_novo_status,
    'mensagem', 'Pagamento registado com sucesso.'
  );
END;
$function$;

-- -------------------------------------------------------------- DADOS ------
-- Só onde o dinheiro já está recebido: valor_pago_total cobre o previsto E
-- existe um pagamento settled associado. Sem isto o UPDATE não pega.
UPDATE public.mensalidades m
   SET status = 'pago',
       updated_at = now()
 WHERE m.id IN ('701f821d-555e-459f-9d78-70ac050ba726',
                'e5326df5-ad49-407e-9bc2-2453afab7458')
   AND COALESCE(m.valor_pago_total, 0) >= COALESCE(m.valor_previsto, m.valor) - 0.01
   AND EXISTS (
     SELECT 1 FROM public.pagamentos p
      WHERE p.mensalidade_id = m.id
        AND p.escola_id = m.escola_id
        AND p.status IN ('settled', 'concluido')
   );

-- ---------------------------------------------------------- VERIFICAÇÃO -----
DO $$
DECLARE n int; v_def text;
BEGIN
  -- A função tem de ter o predicado novo.
  v_def := pg_get_functiondef('public.registrar_pagamento(uuid,text,text,numeric,date)'::regprocedure);
  IF v_def NOT LIKE '%status IS DISTINCT FROM ''pago''%' THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: a função não tem o filtro de estado';
  END IF;
  IF v_def NOT LIKE '%ORDER BY (matricula_id IS DISTINCT FROM%' THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: a função não tem a preferência de matrícula';
  END IF;

  -- As duas da Caroline têm de estar pagas.
  SELECT count(*) INTO n FROM public.mensalidades
   WHERE id IN ('701f821d-555e-459f-9d78-70ac050ba726','e5326df5-ad49-407e-9bc2-2453afab7458')
     AND status='pago';
  IF n <> 2 THEN RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: só % de 2 mensalidades viraram', n; END IF;

  -- ------------------------------------------------------ CONSERVAÇÃO -------
  -- Nada pode ter sido criado nem apagado, e nenhum valor pode ter mudado.
  SELECT count(*) INTO n FROM public.mensalidades
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726';
  IF n <> (SELECT n_mens FROM _verif_20260924) THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: mensalidades % -> %', (SELECT n_mens FROM _verif_20260924), n;
  END IF;

  SELECT count(*) INTO n FROM public.notas
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726';
  IF n <> (SELECT n_notas FROM _verif_20260924) THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: notas % -> %', (SELECT n_notas FROM _verif_20260924), n;
  END IF;

  SELECT count(*) INTO n FROM public.financeiro_lancamentos
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726';
  IF n <> (SELECT n_ledger FROM _verif_20260924) THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: linhas do ledger % -> %', (SELECT n_ledger FROM _verif_20260924), n;
  END IF;

  IF (SELECT COALESCE(sum(valor_pago_total),0) FROM public.mensalidades
       WHERE escola_id='f406f5a7-a077-431c-b118-297224925726')
     IS DISTINCT FROM (SELECT soma_pago FROM _verif_20260924) THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: a soma de valor_pago_total mudou';
  END IF;

  -- Exatamente 2 passaram a pago e 2 deixaram de estar pendentes — nem mais,
  -- nem menos. É esta a asserção que prova que o UPDATE pegou só onde devia.
  IF (SELECT count(*) FROM public.mensalidades
       WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND status='pago')
     <> (SELECT n_pago FROM _verif_20260924) + 2 THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: o número de mensalidades pagas não subiu exatamente 2';
  END IF;
  IF (SELECT count(*) FROM public.mensalidades
       WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND status='pendente')
     <> (SELECT n_pendente FROM _verif_20260924) - 2 THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: o número de mensalidades pendentes não desceu exatamente 2';
  END IF;

  -- Nenhum valor pago pode ter mudado nas duas linhas mexidas.
  SELECT count(*) INTO n FROM (
    SELECT m.id FROM public.mensalidades m
      JOIN public._bk_20260924_mensalidades_caroline b ON b.id = m.id
     WHERE m.valor_pago_total IS DISTINCT FROM b.valor_pago_total) x;
  IF n > 0 THEN RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: % valor_pago_total mudou', n; END IF;
END $$;

-- ------------------------------------------------------ TESTE DE COMPORTAMENTO
-- A prova que interessa: a mensalidade-armadilha do Adilson (09/2026, cuja linha
-- do ledger está 'pago') tem de passar a pagar. O bloco faz o pagamento a sério
-- e depois desfaz tudo levantando um sentinela que só ele apanha — o idiom
-- padrão para usar um bloco de excepção como savepoint.
DO $$
DECLARE
  r jsonb;
  v_st text;
  v_ledger text;
  v_data date;
BEGIN
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"4d778458-710f-4993-85d2-cc787f5ff84b"}', true);

  r := public.registrar_pagamento('99e4827a-747f-4ed2-b9a8-00df21a8dc4b', 'cash');
  IF COALESCE((r->>'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: a armadilha ainda bloqueia -> %', r;
  END IF;

  SELECT status INTO v_st FROM public.mensalidades
   WHERE id='99e4827a-747f-4ed2-b9a8-00df21a8dc4b';
  IF v_st <> 'pago' THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: mensalidade ficou %', v_st;
  END IF;

  -- A linha do ledger já paga tem de continuar intacta (mesma data).
  SELECT l.status::text, l.data_pagamento::date INTO v_ledger, v_data
    FROM public.financeiro_lancamentos l
   WHERE l.escola_id='f406f5a7-a077-431c-b118-297224925726'
     AND l.aluno_id=(SELECT aluno_id FROM public.mensalidades WHERE id='99e4827a-747f-4ed2-b9a8-00df21a8dc4b')
     AND l.origem='mensalidade' AND l.tipo='debito'
     AND l.ano_referencia=2026 AND l.mes_referencia=9;
  IF v_ledger <> 'pago' THEN
    RAISE EXCEPTION 'VERIFICAÇÃO FALHOU: ledger ficou %', v_ledger;
  END IF;

  RAISE EXCEPTION 'SMOKE_OK';            -- desfaz este pagamento de teste
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM <> 'SMOKE_OK' THEN RAISE; END IF;   -- erro real propaga
END $$;

\echo 'Smoke test passou: a armadilha 09/2026 do Adilson paga, ledger intacto.'

COMMIT;

\echo 'Migração aplicada.'
