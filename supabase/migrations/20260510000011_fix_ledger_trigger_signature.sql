-- Migration: 20260510000011_fix_ledger_trigger_signature.sql
-- Descricao: Corrige assinatura usada pelo trigger do ledger e endurece casts tipados.

BEGIN;

-- Compatibilidade: chamadas com literais text/unknown passam a resolver sem erro.
CREATE OR REPLACE FUNCTION public.fn_ledger_insert_once(
    p_escola_id uuid,
    p_aluno_id uuid,
    p_tipo text,
    p_origem text,
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
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM public.fn_ledger_insert_once(
        p_escola_id,
        p_aluno_id,
        p_tipo::public.financeiro_tipo_transacao,
        p_origem::public.financeiro_origem,
        p_referencia_tabela,
        p_referencia_id,
        p_tipo_evento,
        p_versao_evento,
        p_event_key,
        p_valor,
        p_data_competencia,
        p_descricao,
        COALESCE(p_metadata, '{}'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_financeiro_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_competencia date;
    v_new_valor numeric;
    v_old_valor numeric;
BEGIN
    IF TG_TABLE_NAME = 'mensalidades' THEN
        v_new_valor := COALESCE(NEW.valor_previsto, NEW.valor, 0);
        v_old_valor := COALESCE(OLD.valor_previsto, OLD.valor, 0);
        v_competencia := make_date(
            COALESCE(NEW.ano_referencia, EXTRACT(YEAR FROM NEW.data_vencimento)::int),
            COALESCE(NEW.mes_referencia, EXTRACT(MONTH FROM NEW.data_vencimento)::int),
            1
        );

        IF TG_OP = 'INSERT' THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id,
                NEW.aluno_id,
                'debito'::text,
                'mensalidade'::text,
                'mensalidades',
                NEW.id,
                'criado',
                1,
                format('mensalidades:%s:criado:v1', NEW.id::text),
                v_new_valor,
                v_competencia,
                format('Lancamento de mensalidade %s/%s', COALESCE(NEW.mes_referencia, 0), COALESCE(NEW.ano_referencia, 0)),
                '{}'::jsonb
            );

        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto OR OLD.valor IS DISTINCT FROM NEW.valor THEN
                PERFORM public.fn_ledger_insert_once(
                    NEW.escola_id,
                    NEW.aluno_id,
                    CASE WHEN v_new_valor > v_old_valor THEN 'debito' ELSE 'credito' END,
                    'ajuste',
                    'mensalidades',
                    NEW.id,
                    'ajuste_valor',
                    1,
                    format('mensalidades:%s:ajuste_valor:%s', NEW.id::text, COALESCE(NEW.updated_at, now())::text),
                    ABS(v_new_valor - v_old_valor),
                    v_competencia,
                    'Ajuste de valor de mensalidade',
                    '{}'::jsonb
                );
            END IF;

            IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelado' THEN
                PERFORM public.fn_ledger_insert_once(
                    NEW.escola_id,
                    NEW.aluno_id,
                    'credito'::text,
                    'estorno'::text,
                    'mensalidades',
                    NEW.id,
                    'cancelado',
                    1,
                    format('mensalidades:%s:cancelado:v1', NEW.id::text),
                    v_new_valor,
                    v_competencia,
                    'Estorno por cancelamento de mensalidade',
                    '{}'::jsonb
                );
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'pagamentos' THEN
        IF NEW.status IN ('settled', 'concluido') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('settled', 'concluido')) THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id,
                NEW.aluno_id,
                'credito'::text,
                'mensalidade'::text,
                'pagamentos',
                NEW.id,
                'liquidado',
                1,
                format('pagamentos:%s:liquidado:v1', NEW.id::text),
                NEW.valor_pago,
                NEW.data_pagamento,
                'Recebimento de pagamento',
                jsonb_build_object('metodo', NEW.metodo, 'referencia', NEW.reference)
            );
        END IF;

        IF TG_OP = 'UPDATE' AND OLD.status IN ('settled', 'concluido') AND NEW.status IN ('estornado', 'cancelado', 'rejeitado') THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id,
                NEW.aluno_id,
                'debito'::text,
                'estorno'::text,
                'pagamentos',
                NEW.id,
                NEW.status,
                1,
                format('pagamentos:%s:%s:v1', NEW.id::text, NEW.status),
                NEW.valor_pago,
                COALESCE(NEW.data_pagamento, NEW.created_at::date),
                'Reversao de pagamento liquidado',
                jsonb_build_object('metodo', NEW.metodo, 'referencia', NEW.reference, 'status', NEW.status)
            );
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'financeiro_lancamentos' THEN
        IF TG_OP = 'INSERT' AND NEW.origem = 'venda_avulsa' THEN
            PERFORM public.fn_ledger_insert_once(
                NEW.escola_id,
                NEW.aluno_id,
                NEW.tipo::text,
                'venda_avulsa'::text,
                'financeiro_lancamentos',
                NEW.id,
                'criado',
                1,
                format('financeiro_lancamentos:%s:criado:v1', NEW.id::text),
                NEW.valor_total,
                COALESCE(NEW.data_pagamento::date, NEW.created_at::date),
                NEW.descricao,
                '{}'::jsonb
            );
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

COMMIT;
