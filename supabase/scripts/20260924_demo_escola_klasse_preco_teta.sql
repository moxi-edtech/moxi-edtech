-- ============================================================================
-- KLASSE - Escola KLASSE: preco de 2026 do curso Tecnico de Analises Clinicas
--           e desbloqueio da aluna Teta Beta Lando
--
-- CONTEXTO
--   A aluna Teta Beta Lando (matricula 2026 d27ae33d, turma 52515a97,
--   "ACL-11a Classe-M-A", curso 4a7cd535 Tecnico de Analises Clinicas) tinha
--   quatro mensalidades pendentes de valor 0,00 (08 a 11/2026), criadas pelo
--   gerador quando nenhuma regra de financeiro_tabelas cobria a turma e o
--   preco caia no literal 0.
--
--   Essas linhas sao um beco sem saida por dois caminhos independentes:
--     - pagar o valor devido (23.000,00) sobre uma linha de 0,00 e recusado
--       com "Valor pago excede o valor previsto da mensalidade";
--     - pagar 0,00 e recusado com "Valor de pagamento deve ser maior que zero".
--   E, como financeiro_validar_ordem_pagamento_mensalidade trata qualquer
--   status <> 'pago' como mes em aberto, independentemente do valor, o 08/2026
--   bloqueava tambem o 09, o 10 e o 11. A aluna estava congelada no ano.
--
--   O gerador ja foi corrigido (supabase/migrations/20260924010000_*) e deixou
--   de criar linhas sem preco. Este script trata do que ja existe.
--
-- O QUE FAZ
--   1. Guarda copia das quatro linhas numa tabela de backup (fora da
--      transaccao, para sobreviver a qualquer falha).
--   2. Cria a regra de preco que faltava: 2026, curso 4a7cd535 + 11a Classe,
--      23.000,00, vencimento ao dia 1.
--   3. Apaga as quatro linhas de 0,00.
--   4. Regera os meses 08 a 11/2026 pelo mesmo caminho que a aplicacao usa:
--      a RPC public.gerar_mensalidades_lote mais o back-fill de matricula_id
--      que a rota /api/financeiro/mensalidades/gerar faz a seguir.
--   5. Prova, dentro da transaccao e revertendo, que o pagamento do 08/2026
--      passa a ser aceite.
--
-- DECISOES QUE FORAM PEDIDAS AO UTILIZADOR
--   valor (23.000,00): escolhido pelo utilizador. E o unico valor que ja foi
--     efectivamente cobrado a esta classe (10 mensalidades pagas, 09/2025 a
--     06/2026) mas NAO existia em financeiro_tabelas - foi reconstruido, nao
--     lido. Nao ha nenhuma linha de preco para este curso em ano nenhum.
--   dia_vencimento (1): escolha minha, nao pedida. As 10 mensalidades pagas
--     dela sao todas ao dia 1, e as regras de 2026 do Io Ciclo do Secundario
--     tambem usam o dia 1. As quatro linhas a 0,00 estavam ao dia 10 apenas
--     porque, sem regra, caíam no valor por omissao da RPC.
--   apagar as quatro linhas: autorizado explicitamente pelo utilizador.
--
-- REVERSAO
--   DELETE FROM public.financeiro_tabelas
--    WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND ano_letivo=2026
--      AND curso_id='4a7cd535-ec61-4ad8-aaca-4105c50a51f2'
--      AND classe_id='12319220-d22c-4ccd-8a24-8d8c1d94d53f';
--   DELETE FROM public.mensalidades
--    WHERE id IN (SELECT id FROM public._bk_20260924b_mensalidades_teta);
--   INSERT INTO public.mensalidades SELECT * FROM public._bk_20260924b_mensalidades_teta;
--
-- NAO usar `supabase db push`: o schema_migrations local nao e fiavel neste
-- projecto. Este script e para correr com psql contra a base indicada.
-- ============================================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------- 1. BACKUP (fora da txn) --
-- Sem IF NOT EXISTS de proposito: uma segunda execucao deve falhar alto em vez
-- de gravar por cima do backup original.
CREATE TABLE public._bk_20260924b_mensalidades_teta AS
SELECT * FROM public.mensalidades
 WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726'
   AND aluno_id  = '5f531cdd-96db-4549-97b4-88f74e59510d'
   AND ano_referencia = 2026
   AND mes_referencia BETWEEN 8 AND 11
   AND status = 'pendente'
   AND COALESCE(valor, 0) = 0
   AND COALESCE(valor_previsto, 0) = 0;

BEGIN;

CREATE TEMP TABLE _snap_20260924b ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM public.mensalidades WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS n_mens,
  (SELECT COALESCE(sum(valor_previsto),0) FROM public.mensalidades WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS soma_previsto,
  (SELECT COALESCE(sum(valor_pago_total),0) FROM public.mensalidades WHERE escola_id='f406f5a7-a077-431c-b118-297224925726') AS soma_pago;

-- ------------------------------- 2 a 5. PRECO, LIMPEZA, REGERACAO E PROVA --
DO $run$
DECLARE
  v_n        int;
  v_valor    numeric;
  v_dia      int;
  v_tabela   uuid;
  v_mes      int;
  v_res      jsonb;
  v_antes    jsonb;
  v_depois_n int;
BEGIN
  -- ---- estado inicial: tem de haver exactamente 4 linhas a 0,00 ----------
  SELECT count(*) INTO v_n FROM public._bk_20260924b_mensalidades_teta;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'ABORTADO: o backup apanhou % linhas a 0,00 (esperava 4)', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM public.financeiro_tabelas
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND ano_letivo=2026
     AND curso_id='4a7cd535-ec61-4ad8-aaca-4105c50a51f2'
     AND classe_id='12319220-d22c-4ccd-8a24-8d8c1d94d53f';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'ABORTADO: ja existe preco de 2026 para este curso+classe (%)', v_n;
  END IF;

  -- ---- a prova do "antes": pagar o valor devido era recusado -------------
  -- O NOTICE tem de sair ANTES do sentinela: variaveis atribuidas dentro da
  -- subtransaccao voltam ao valor anterior quando o handler apanha a excepcao.
  BEGIN
    v_antes := public.registrar_pagamento('e6fd3f84-e894-4d8a-bac9-525475661642', 'numerario', 'PROVA ANTES (revertida)', 23000, NULL);
    RAISE NOTICE 'ANTES: pagar 23.000,00 no 08/2026 (linha a 0,00) -> %', v_antes;
    RAISE EXCEPTION 'AB_ROLLBACK_ANTES';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AB_ROLLBACK_ANTES' THEN
      RAISE NOTICE 'ANTES: pagar 23.000,00 no 08/2026 levantou excepcao -> %', SQLERRM;
    END IF;
  END;

  -- ---- 2. a regra de preco que faltava -----------------------------------
  INSERT INTO public.financeiro_tabelas
    (escola_id, ano_letivo, curso_id, classe_id, valor_mensalidade, dia_vencimento)
  VALUES
    ('f406f5a7-a077-431c-b118-297224925726', 2026,
     '4a7cd535-ec61-4ad8-aaca-4105c50a51f2',
     '12319220-d22c-4ccd-8a24-8d8c1d94d53f',
     23000.00, 1)
  ON CONFLICT (escola_id, ano_letivo, curso_id, classe_id) DO NOTHING;

  SELECT id, valor_mensalidade, dia_vencimento INTO v_tabela, v_valor, v_dia
    FROM public.financeiro_tabelas
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726' AND ano_letivo=2026
     AND curso_id='4a7cd535-ec61-4ad8-aaca-4105c50a51f2'
     AND classe_id='12319220-d22c-4ccd-8a24-8d8c1d94d53f';
  IF v_valor <> 23000.00 THEN
    RAISE EXCEPTION 'ABORTADO: o preco existente e % e nao 23.000,00 - nao sobrescrevo precos', v_valor;
  END IF;
  RAISE NOTICE 'PRECO: 2026 / Tecnico de Analises Clinicas / 11a Classe = % ao dia % (tabela_id %)', v_valor, v_dia, v_tabela;

  -- ---- 3. apagar as quatro linhas a 0,00 ---------------------------------
  DELETE FROM public.mensalidades
   WHERE id IN (SELECT id FROM public._bk_20260924b_mensalidades_teta);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'ABORTADO: apaguei % linhas (esperava 4)', v_n;
  END IF;
  RAISE NOTICE 'LIMPEZA: % linhas a 0,00 apagadas (copia em _bk_20260924b_mensalidades_teta)', v_n;

  -- ---- 4. regerar 08..11/2026 pelo caminho da aplicacao ------------------
  FOR v_mes IN 8..11 LOOP
    v_res := public.gerar_mensalidades_lote(
               'f406f5a7-a077-431c-b118-297224925726', 2026, v_mes, 1,
               '52515a97-5aa5-4087-9de2-a771c0fce453');
    IF (v_res->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'ABORTADO: a geracao de %/2026 devolveu erro: %', v_mes, v_res;
    END IF;
    IF (v_res->>'geradas')::int <> 1 THEN
      RAISE EXCEPTION 'ABORTADO: a geracao de %/2026 criou % linhas (esperava 1)', v_mes, v_res->>'geradas';
    END IF;
    IF (v_res->>'sem_preco')::int <> 0 THEN
      RAISE EXCEPTION 'ABORTADO: %/2026 ainda sem preco: %', v_mes, v_res;
    END IF;

    -- o mesmo back-fill que a rota /api/financeiro/mensalidades/gerar faz
    UPDATE public.mensalidades SET matricula_id = 'd27ae33d-4622-4b14-acae-cf70b4e70fea'
     WHERE escola_id = 'f406f5a7-a077-431c-b118-297224925726'
       AND aluno_id  = '5f531cdd-96db-4549-97b4-88f74e59510d'
       AND turma_id  = '52515a97-5aa5-4087-9de2-a771c0fce453'
       AND ano_letivo = '2026'
       AND mes_referencia = v_mes
       AND matricula_id IS NULL
       AND status IN ('pendente', 'aberta');

    RAISE NOTICE 'GERACAO: %/2026 -> %', v_mes, v_res;
  END LOOP;

  -- ---- 5. as quatro linhas novas tem de estar certas ---------------------
  SELECT count(*) INTO v_n FROM public.mensalidades
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726'
     AND aluno_id='5f531cdd-96db-4549-97b4-88f74e59510d'
     AND ano_referencia=2026 AND mes_referencia BETWEEN 8 AND 11
     AND valor = 23000.00 AND valor_previsto = 23000.00 AND status = 'pendente'
     AND matricula_id = 'd27ae33d-4622-4b14-acae-cf70b4e70fea'
     AND tabela_id = v_tabela
     AND EXTRACT(DAY FROM data_vencimento) = 1;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'ABORTADO: so % de 4 linhas ficaram correctas', v_n;
  END IF;
  RAISE NOTICE 'VERIFICACAO: as 4 linhas estao a 23.000,00, pendentes, vencimento ao dia 1, com tabela_id e matricula_id.';

  -- ---- a prova do "depois": pagar o 08/2026 passa a ser aceite -----------
  BEGIN
    v_res := public.registrar_pagamento(
               (SELECT id FROM public.mensalidades
                 WHERE escola_id='f406f5a7-a077-431c-b118-297224925726'
                   AND aluno_id='5f531cdd-96db-4549-97b4-88f74e59510d'
                   AND ano_referencia=2026 AND mes_referencia=8),
               'numerario', 'PROVA DEPOIS (revertida)', 23000, NULL);
    IF (v_res->>'ok')::boolean IS NOT TRUE THEN
      RAISE EXCEPTION 'PROVA DEPOIS FALHOU: o pagamento do 08/2026 ainda e recusado: %', v_res;
    END IF;
    RAISE NOTICE 'DEPOIS: pagar 23.000,00 no 08/2026 -> %', v_res;
    RAISE EXCEPTION 'AB_ROLLBACK_DEPOIS';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'AB_ROLLBACK_DEPOIS' THEN RAISE; END IF;
  END;

  -- ---- o pagamento da prova nao pode ter ficado --------------------------
  SELECT count(*) INTO v_depois_n FROM public.pagamentos
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726'
     AND mensalidade_id IN (SELECT id FROM public.mensalidades
                             WHERE escola_id='f406f5a7-a077-431c-b118-297224925726'
                               AND aluno_id='5f531cdd-96db-4549-97b4-88f74e59510d'
                               AND ano_referencia=2026 AND mes_referencia BETWEEN 8 AND 11);
  IF v_depois_n <> 0 THEN
    RAISE EXCEPTION 'ABORTADO: a prova deixou % pagamentos', v_depois_n;
  END IF;
END $run$;

-- ------------------------------------------- conservacao: nada mais mudou --
DO $verif$
DECLARE n_mens bigint; soma_previsto numeric; soma_pago numeric;
BEGIN
  SELECT count(*) INTO n_mens FROM public.mensalidades
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726';
  SELECT COALESCE(sum(valor_previsto),0), COALESCE(sum(valor_pago_total),0)
    INTO soma_previsto, soma_pago FROM public.mensalidades
   WHERE escola_id='f406f5a7-a077-431c-b118-297224925726';

  -- qualificar sempre com o alias: sem ele o plpgsql confunde as variaveis com
  -- as colunas de mesmo nome da tabela de instantaneo.
  IF n_mens <> (SELECT s.n_mens FROM _snap_20260924b s) THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: mensalidades % -> %', (SELECT s.n_mens FROM _snap_20260924b s), n_mens;
  END IF;
  IF soma_pago IS DISTINCT FROM (SELECT s.soma_pago FROM _snap_20260924b s) THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: a soma de valor_pago_total mudou';
  END IF;
  -- quatro meses de 23.000,00 substituem quatro meses de 0,00
  IF soma_previsto <> (SELECT s.soma_previsto FROM _snap_20260924b s) + 92000.00 THEN
    RAISE EXCEPTION 'VERIFICACAO FALHOU: soma de valor_previsto % (esperava % + 92.000,00)',
      soma_previsto, (SELECT s.soma_previsto FROM _snap_20260924b s);
  END IF;

  RAISE NOTICE 'Conservacao ok: mensalidades %, soma previsto % (+92.000,00), soma pago % intacta.',
    n_mens, soma_previsto, soma_pago;
END $verif$;

COMMIT;
