-- supabase/migrations/20260127140000_create_confirmar_conciliacao_transacao_rpc.sql
CREATE OR REPLACE FUNCTION public.confirmar_conciliacao_transacao(
    p_escola_id UUID,
    p_transacao_id UUID,
    p_aluno_id UUID,
    p_mensalidade_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_transacao_importada public.financeiro_transacoes_importadas;
    v_mensalidade public.mensalidades;
    v_lancamento_id UUID;
    v_status_mensalidade TEXT := 'pago'; -- Default status for full payment
BEGIN
    -- 1. Iniciar transação
    BEGIN
        -- 2. Validar Transação Importada
        SELECT * INTO v_transacao_importada
        FROM public.financeiro_transacoes_importadas
        WHERE id = p_transacao_id AND escola_id = p_escola_id;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', 'Transação importada não encontrada ou não pertence à escola.');
        END IF;

        IF v_transacao_importada.status <> 'pendente' THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', 'Transação importada já foi processada.');
        END IF;

        -- 3. Validar Aluno
        PERFORM id FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', 'Aluno não encontrado ou não pertence à escola.');
        END IF;

        -- 4. Processar Mensalidade (se fornecida)
        IF p_mensalidade_id IS NOT NULL THEN
            SELECT * INTO v_mensalidade
            FROM public.mensalidades
            WHERE id = p_mensalidade_id AND aluno_id = p_aluno_id AND escola_id = p_escola_id;

            IF NOT FOUND THEN
                RETURN jsonb_build_object('ok', FALSE, 'erro', 'Mensalidade não encontrada ou não corresponde ao aluno/escola.');
            END IF;

            IF v_mensalidade.status = 'pago' THEN
                RETURN jsonb_build_object('ok', FALSE, 'erro', 'Mensalidade já está paga.');
            END IF;

            -- Verificar se o valor da transação cobre a mensalidade
            IF v_transacao_importada.valor < v_mensalidade.valor THEN
                -- Se o valor for parcial, o status da mensalidade pode ser "pago_parcial"
                -- Isso exige uma lógica mais complexa de estorno/ajuste
                -- Por simplicidade, vamos considerar que deve ser valor total ou retornar erro.
                -- Futuramente, pode-se criar um `financeiro_lancamentos` para o valor remanescente
                RETURN jsonb_build_object('ok', FALSE, 'erro', 'Valor da transação inferior ao valor da mensalidade. Pagamentos parciais não são suportados nesta conciliação automática.');
            END IF;
            
            -- Atualizar Mensalidade para paga
            UPDATE public.mensalidades
            SET
                status = v_status_mensalidade,
                data_pagamento_efetiva = v_transacao_importada.data,
                metodo_pagamento = v_transacao_importada.banco, -- Usar o banco como método inicial
                updated_at = NOW()
            WHERE id = p_mensalidade_id;

        END IF; -- END IF p_mensalidade_id IS NOT NULL

        -- 5. Criar Lançamento Financeiro (independente de mensalidade)
        INSERT INTO public.financeiro_lancamentos (
            escola_id,
            aluno_id,
            matricula_id, -- Se houver uma forma de obter a matricula_id aqui
            tipo,
            origem,
            descricao,
            valor_original,
            data_pagamento,
            metodo_pagamento,
            created_by,
            mes_referencia,
            ano_referencia,
            status,
            data_vencimento -- Pode ser o mesmo da data da transação para pagamentos únicos
        ) VALUES (
            p_escola_id,
            p_aluno_id,
            v_mensalidade.matricula_id, -- Se mensalidade existe, usa a dela
            'credito', -- Sempre um crédito para a escola
            'conciliacao_bancaria',
            'Pagamento conciliado: ' || v_transacao_importada.descricao || ' (' || v_transacao_importada.referencia || ')',
            v_transacao_importada.valor,
            NOW(), -- Data de registro do lançamento
            v_transacao_importada.banco,
            p_user_id,
            EXTRACT(MONTH FROM v_transacao_importada.data),
            EXTRACT(YEAR FROM v_transacao_importada.data),
            'pago',
            v_transacao_importada.data -- Data da transação como vencimento para facilitar busca
        ) RETURNING id INTO v_lancamento_id;

        -- 6. Atualizar Status da Transação Importada
        UPDATE public.financeiro_transacoes_importadas
        SET
            status = 'conciliado',
            aluno_match_details = jsonb_set(aluno_match_details, '{mensalidadeConciliadaId}', to_jsonb(p_mensalidade_id)),
            updated_at = NOW()
        WHERE id = p_transacao_id;

        -- 7. Log de Auditoria (opcional, pode ser feito por trigger)
        -- INSERT INTO audit_logs ...

        RETURN jsonb_build_object('ok', TRUE, 'lancamento_id', v_lancamento_id);

    EXCEPTION
        WHEN OTHERS THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', SQLERRM);
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
