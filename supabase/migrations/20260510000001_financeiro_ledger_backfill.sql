-- Migration: 20260510000001_financeiro_ledger_backfill.sql
-- Descrição: Povoamento inicial do Ledger com dados históricos.
-- Nota: Executar APÓS a criação da tabela financeiro_ledger, mas os triggers podem estar ativos.
--       O uso de subqueries garante que não haverá duplicidade se rodado múltiplas vezes.

BEGIN;

-- 1. Backfill de Mensalidades (Débitos Originais)
INSERT INTO public.financeiro_ledger (
    escola_id, aluno_id, tipo, origem, referencia_tabela, referencia_id, tipo_evento, versao_evento, event_key, valor, data_competencia, descricao
)
SELECT 
    m.escola_id, 
    m.aluno_id, 
    'debito', 
    'mensalidade', 
    'mensalidades', 
    m.id, 
    'criado',
    1,
    format('mensalidades:%s:criado:v1', m.id::text),
    COALESCE(m.valor_previsto, m.valor), 
    make_date(COALESCE(m.ano_referencia, 2026), COALESCE(m.mes_referencia, 1), 1),
    'Histórico: Lançamento de mensalidade'
FROM public.mensalidades m
ON CONFLICT (event_key) DO NOTHING;

-- 2. Backfill de Pagamentos (Créditos)
INSERT INTO public.financeiro_ledger (
    escola_id, aluno_id, tipo, origem, referencia_tabela, referencia_id, tipo_evento, versao_evento, event_key, valor, data_competencia, descricao, metadata
)
SELECT 
    p.escola_id, 
    p.aluno_id, 
    'credito', 
    'mensalidade', 
    'pagamentos', 
    p.id, 
    'liquidado',
    1,
    format('pagamentos:%s:liquidado:v1', p.id::text),
    p.valor_pago, 
    COALESCE(p.data_pagamento, p.created_at::date),
    'Histórico: Recebimento de pagamento',
    jsonb_build_object('metodo', p.metodo, 'referencia', p.reference)
FROM public.pagamentos p
WHERE p.status IN ('settled', 'concluido')
ON CONFLICT (event_key) DO NOTHING;

-- 3. Backfill de Vendas Avulsas
INSERT INTO public.financeiro_ledger (
    escola_id, aluno_id, tipo, origem, referencia_tabela, referencia_id, tipo_evento, versao_evento, event_key, valor, data_competencia, descricao
)
SELECT 
    fl.escola_id, 
    fl.aluno_id, 
    fl.tipo, 
    'venda_avulsa', 
    'financeiro_lancamentos', 
    fl.id, 
    'criado',
    1,
    format('financeiro_lancamentos:%s:criado:v1', fl.id::text),
    fl.valor_total, 
    COALESCE(fl.data_pagamento::date, fl.created_at::date),
    fl.descricao
FROM public.financeiro_lancamentos fl
WHERE fl.origem = 'venda_avulsa'
ON CONFLICT (event_key) DO NOTHING;

COMMIT;
