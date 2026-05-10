-- Migration: 20260510000003_view_reconciliacao_ledger.sql
-- Descrição: Criação de View para Reconciliação entre o Ledger (Novo) e o Legado.
-- Objetivo: Identificar discrepâncias de centavos ou falhas de sincronização.

BEGIN;

CREATE OR REPLACE VIEW public.vw_financeiro_reconciliacao_ledger AS
WITH legacy_mensalidades AS (
    -- Soma de todas as mensalidades (débitos originais)
    SELECT 
        escola_id, 
        aluno_id, 
        SUM(COALESCE(valor_previsto, valor)) as total_debito_mensalidade
    FROM public.mensalidades
    WHERE status <> 'cancelado'
    GROUP BY escola_id, aluno_id
),
legacy_pagamentos AS (
    -- Soma de todos os pagamentos (créditos reais)
    SELECT 
        escola_id, 
        aluno_id, 
        SUM(valor_pago) as total_credito_pagamento
    FROM public.pagamentos
    WHERE status IN ('settled', 'concluido')
    GROUP BY escola_id, aluno_id
),
legacy_lancamentos AS (
    -- Soma de vendas avulsas e outros lançamentos manuais
    SELECT 
        escola_id, 
        aluno_id, 
        SUM(CASE WHEN tipo = 'debito' THEN valor_total ELSE 0 END) as total_debito_avulso,
        SUM(CASE WHEN tipo = 'credito' THEN valor_total ELSE 0 END) as total_credito_avulso
    FROM public.financeiro_lancamentos
    WHERE origem = 'venda_avulsa'
    GROUP BY escola_id, aluno_id
),
ledger_totals AS (
    -- Balanço consolidado no novo Ledger
    SELECT 
        escola_id, 
        aluno_id,
        SUM(CASE WHEN tipo = 'debito' THEN valor ELSE 0 END) as ledger_total_debito,
        SUM(CASE WHEN tipo = 'credito' THEN valor ELSE 0 END) as ledger_total_credito,
        SUM(CASE WHEN tipo = 'debito' THEN valor ELSE -valor END) as ledger_saldo_final
    FROM public.financeiro_ledger
    GROUP BY escola_id, aluno_id
)
SELECT 
    e.nome as escola_nome,
    a.nome as aluno_nome,
    lt.escola_id,
    lt.aluno_id,
    
    -- Legado
    COALESCE(lm.total_debito_mensalidade, 0) + COALESCE(la.total_debito_avulso, 0) as legacy_total_debito,
    COALESCE(lp.total_credito_pagamento, 0) + COALESCE(la.total_credito_avulso, 0) as legacy_total_credito,
    (COALESCE(lm.total_debito_mensalidade, 0) + COALESCE(la.total_debito_avulso, 0)) - 
    (COALESCE(lp.total_credito_pagamento, 0) + COALESCE(la.total_credito_avulso, 0)) as legacy_saldo_devedor,
    
    -- Ledger
    lt.ledger_total_debito,
    lt.ledger_total_credito,
    lt.ledger_saldo_final,
    
    -- Discrepância (Diferença entre Ledger e Legado)
    -- Um valor diferente de zero indica erro no backfill ou trigger.
    (lt.ledger_total_debito - (COALESCE(lm.total_debito_mensalidade, 0) + COALESCE(la.total_debito_avulso, 0))) as discrepancia_debito,
    (lt.ledger_total_credito - (COALESCE(lp.total_credito_pagamento, 0) + COALESCE(la.total_credito_avulso, 0))) as discrepancia_credito
FROM ledger_totals lt
JOIN public.escolas e ON e.id = lt.escola_id
JOIN public.alunos a ON a.id = lt.aluno_id
LEFT JOIN legacy_mensalidades lm ON lm.aluno_id = lt.aluno_id
LEFT JOIN legacy_pagamentos lp ON lp.aluno_id = lt.aluno_id
LEFT JOIN legacy_lancamentos la ON la.aluno_id = lt.aluno_id;

COMMENT ON VIEW public.vw_financeiro_reconciliacao_ledger IS 'View de auditoria para validar integridade do Ledger vs Tabelas Legadas.';

COMMIT;
