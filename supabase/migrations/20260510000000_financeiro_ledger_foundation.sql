-- Migration: 20260510000000_financeiro_ledger_foundation.sql
-- Descrição: Implementação do Livro Razão (Ledger) Central para o Financeiro K12
-- Objetivo: Criar SSOT para débitos e créditos com sincronização via Triggers.

BEGIN;

-- 1. Expansão de Enums para suporte ao Ledger
ALTER TYPE public.financeiro_origem ADD VALUE IF NOT EXISTS 'estorno';
ALTER TYPE public.financeiro_origem ADD VALUE IF NOT EXISTS 'ajuste';
ALTER TYPE public.financeiro_origem ADD VALUE IF NOT EXISTS 'servico_balcao';

-- 2. Criação da Tabela de Ledger (Append-Only)
CREATE TABLE IF NOT EXISTS public.financeiro_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escola_id uuid NOT NULL REFERENCES public.escolas(id) ON DELETE CASCADE,
    aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
    
    -- Natureza do movimento
    tipo public.financeiro_tipo_transacao NOT NULL, -- 'debito' | 'credito'
    origem public.financeiro_origem NOT NULL,
    
    -- Rastreabilidade (Links Polimórficos)
    referencia_tabela text NOT NULL, -- 'mensalidades', 'pagamentos', 'financeiro_lancamentos'
    referencia_id uuid NOT NULL,
    tipo_evento text NOT NULL, -- 'criado', 'ajuste_valor', 'liquidado', 'estornado', 'cancelado'
    versao_evento int NOT NULL DEFAULT 1,
    event_key text NOT NULL,
    
    -- Valores e Balanço
    valor numeric(14,2) NOT NULL CHECK (valor >= 0),
    saldo_apos_movimento numeric(14,2), -- Snapshot para auditoria e performance
    
    -- Temporalidade
    data_competencia date NOT NULL, -- Mês/Ano de referência do serviço/mensalidade
    data_movimento timestamptz NOT NULL DEFAULT now(),
    
    -- Metadados e Auditoria
    descricao text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 3. Índices Críticos
CREATE INDEX IF NOT EXISTS ix_ledger_aluno_data ON public.financeiro_ledger (aluno_id, data_movimento DESC);
CREATE INDEX IF NOT EXISTS ix_ledger_escola_competencia ON public.financeiro_ledger (escola_id, data_competencia);
CREATE INDEX IF NOT EXISTS ix_ledger_referencia ON public.financeiro_ledger (referencia_tabela, referencia_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ledger_event_key ON public.financeiro_ledger (event_key);
CREATE INDEX IF NOT EXISTS ix_ledger_escola_aluno_movimento ON public.financeiro_ledger (escola_id, aluno_id, data_movimento, id);

-- 4. Helper de escrita idempotente no Ledger
CREATE OR REPLACE FUNCTION public.fn_ledger_insert_once(
    p_escola_id uuid,
    p_aluno_id uuid,
    p_tipo public.financeiro_tipo_transacao,
    p_origem public.financeiro_origem,
    p_referencia_tabela text,
    p_referencia_id uuid,
    p_tipo_evento text,
    p_versao_evento int,
    p_event_key text,
    p_valor numeric,
    p_data_competencia date,
    p_descricao text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.financeiro_ledger (
        escola_id,
        aluno_id,
        tipo,
        origem,
        referencia_tabela,
        referencia_id,
        tipo_evento,
        versao_evento,
        event_key,
        valor,
        data_competencia,
        descricao,
        metadata
    )
    VALUES (
        p_escola_id,
        p_aluno_id,
        p_tipo,
        p_origem,
        p_referencia_tabela,
        p_referencia_id,
        p_tipo_evento,
        p_versao_evento,
        p_event_key,
        p_valor,
        p_data_competencia,
        p_descricao,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    ON CONFLICT (event_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. Função de Sincronização (Trigger Function)
CREATE OR REPLACE FUNCTION public.fn_sync_financeiro_ledger()
RETURNS TRIGGER AS $$
BEGIN
    -- Lógica para MENSALIDADES (Débitos e Ajustes)
    IF (TG_TABLE_NAME = 'mensalidades') THEN
        IF (TG_OP = 'INSERT') THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id, NEW.aluno_id, 'debito', 'mensalidade', 'mensalidades', NEW.id, 
                'criado', 1, format('mensalidades:%s:criado:v1', NEW.id::text),
                COALESCE(NEW.valor_previsto, NEW.valor), 
                make_date(COALESCE(NEW.ano_referencia, EXTRACT(YEAR FROM NEW.data_vencimento)::int), COALESCE(NEW.mes_referencia, EXTRACT(MONTH FROM NEW.data_vencimento)::int), 1),
                'Lançamento de mensalidade: ' || COALESCE(NEW.mes_referencia::text, '') || '/' || COALESCE(NEW.ano_referencia::text, ''),
                '{}'::jsonb
            );
        ELSIF (TG_OP = 'UPDATE') THEN
            -- Se o valor mudou, registra o ajuste
            IF (OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto OR OLD.valor IS DISTINCT FROM NEW.valor) THEN
                PERFORM public.fn_ledger_insert_once(
                    NEW.escola_id, NEW.aluno_id, 
                    CASE WHEN COALESCE(NEW.valor_previsto, NEW.valor) > COALESCE(OLD.valor_previsto, OLD.valor) THEN 'debito' ELSE 'credito' END, 
                    'ajuste', 'mensalidades', NEW.id, 
                    'ajuste_valor', 1,
                    format(
                        'mensalidades:%s:ajuste_valor:%s',
                        NEW.id::text,
                        clock_timestamp()::text
                    ),
                    ABS(COALESCE(NEW.valor_previsto, NEW.valor) - COALESCE(OLD.valor_previsto, OLD.valor)), 
                    make_date(COALESCE(NEW.ano_referencia, EXTRACT(YEAR FROM NEW.data_vencimento)::int), COALESCE(NEW.mes_referencia, EXTRACT(MONTH FROM NEW.data_vencimento)::int), 1),
                    'Ajuste de valor de mensalidade',
                    '{}'::jsonb
                );
            END IF;
            
            -- Se foi cancelada, gera um crédito de estorno
            IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado') THEN
                 PERFORM public.fn_ledger_insert_once(
                    NEW.escola_id, NEW.aluno_id, 'credito', 'estorno', 'mensalidades', NEW.id, 
                    'cancelado', 1, format('mensalidades:%s:cancelado:v1', NEW.id::text),
                    COALESCE(NEW.valor_previsto, NEW.valor), 
                    make_date(COALESCE(NEW.ano_referencia, EXTRACT(YEAR FROM NEW.data_vencimento)::int), COALESCE(NEW.mes_referencia, EXTRACT(MONTH FROM NEW.data_vencimento)::int), 1),
                    'Estorno por cancelamento de mensalidade',
                    '{}'::jsonb
                );
            END IF;
        END IF;
    END IF;

    -- Lógica para PAGAMENTOS (Créditos)
    IF (TG_TABLE_NAME = 'pagamentos') THEN
        -- Apenas pagamentos confirmados/liquidados entram no Ledger
        IF (NEW.status IN ('settled', 'concluido') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('settled', 'concluido'))) THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id, NEW.aluno_id, 'credito', 'mensalidade', 'pagamentos', NEW.id, 
                'liquidado', 1, format('pagamentos:%s:liquidado:v1', NEW.id::text),
                NEW.valor_pago, NEW.data_pagamento, 'Recebimento de pagamento',
                jsonb_build_object('metodo', NEW.metodo, 'referencia', NEW.reference)
            );
        END IF;

        -- Reversão / estorno / cancelamento de pagamento previamente liquidado
        IF (
            TG_OP = 'UPDATE'
            AND OLD.status IN ('settled', 'concluido')
            AND NEW.status IN ('estornado', 'cancelado', 'rejeitado')
        ) THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id, NEW.aluno_id, 'debito', 'estorno', 'pagamentos', NEW.id,
                NEW.status, 1, format('pagamentos:%s:%s:v1', NEW.id::text, NEW.status),
                NEW.valor_pago, COALESCE(NEW.data_pagamento, NEW.created_at::date),
                'Reversão de pagamento liquidado',
                jsonb_build_object('metodo', NEW.metodo, 'referencia', NEW.reference, 'status', NEW.status)
            );
        END IF;
    END IF;

    -- Lógica para LANÇAMENTOS (Vendas Avulsas / Serviços)
    IF (TG_TABLE_NAME = 'financeiro_lancamentos') THEN
        IF (TG_OP = 'INSERT' AND NEW.origem = 'venda_avulsa') THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id, NEW.aluno_id, NEW.tipo, 'venda_avulsa', 'financeiro_lancamentos', NEW.id, 
                'criado', 1, format('financeiro_lancamentos:%s:criado:v1', NEW.id::text),
                NEW.valor_total, COALESCE(NEW.data_pagamento::date, NEW.created_at::date), NEW.descricao
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Aplicação dos Triggers
DROP TRIGGER IF EXISTS trg_ledger_sync_mensalidades ON public.mensalidades;
CREATE TRIGGER trg_ledger_sync_mensalidades 
    AFTER INSERT OR UPDATE ON public.mensalidades 
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_financeiro_ledger();

DROP TRIGGER IF EXISTS trg_ledger_sync_pagamentos ON public.pagamentos;
CREATE TRIGGER trg_ledger_sync_pagamentos 
    AFTER INSERT OR UPDATE ON public.pagamentos 
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_financeiro_ledger();

DROP TRIGGER IF EXISTS trg_ledger_sync_lancamentos ON public.financeiro_lancamentos;
CREATE TRIGGER trg_ledger_sync_lancamentos 
    AFTER INSERT ON public.financeiro_lancamentos 
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_financeiro_ledger();

-- 7. RLS (Isolamento por Escola)
ALTER TABLE public.financeiro_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Ledger por Escola" ON public.financeiro_ledger;
CREATE POLICY "Acesso Ledger por Escola" ON public.financeiro_ledger
    FOR ALL
    USING (escola_id IN (SELECT escola_id FROM public.escola_users WHERE user_id = auth.uid()));

COMMIT;
