BEGIN;

-- =================================================================
-- ATUALIZAÇÃO RPC: `confirmar_conciliacao_transacao`
--
-- OBJETIVO:
-- 1. Adicionar auditoria explícita à confirmação de conciliação de transações.
-- =================================================================

CREATE OR REPLACE FUNCTION public.confirmar_conciliacao_transacao(p_escola_id uuid, p_transacao_id uuid, p_aluno_id uuid, p_mensalidade_id uuid DEFAULT NULL::uuid, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_transacao_importada public.financeiro_transacoes_importadas;
    v_mensalidade public.mensalidades;
    v_lancamento_id UUID;
    v_status_mensalidade TEXT := 'pago'; -- Default status for full payment
    v_actor_id uuid := COALESCE(p_user_id, auth.uid()); -- Usa p_user_id se fornecido, senão o usuário autenticado
BEGIN
    -- 1. Validar Transação Importada
    SELECT * INTO v_transacao_importada
    FROM public.financeiro_transacoes_importadas
    WHERE id = p_transacao_id AND escola_id = p_escola_id
    FOR UPDATE; -- Lock na transação importada

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'erro', 'Transação importada não encontrada ou não pertence à escola.');
    END IF;

    IF v_transacao_importada.status <> 'pendente' THEN
        RETURN jsonb_build_object('ok', FALSE, 'erro', 'Transação importada já foi processada.');
    END IF;

    -- 2. Validar Aluno
    PERFORM id FROM public.alunos WHERE id = p_aluno_id AND escola_id = p_escola_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'erro', 'Aluno não encontrado ou não pertence à escola.');
    END IF;

    -- 3. Processar Mensalidade (se fornecida)
    IF p_mensalidade_id IS NOT NULL THEN
        SELECT * INTO v_mensalidade
        FROM public.mensalidades
        WHERE id = p_mensalidade_id AND aluno_id = p_aluno_id AND escola_id = p_escola_id
        FOR UPDATE; -- Lock na mensalidade

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', 'Mensalidade não encontrada ou não corresponde ao aluno/escola.');
        END IF;

        IF v_mensalidade.status = 'pago' THEN
            RETURN jsonb_build_object('ok', FALSE, 'erro', 'Mensalidade já está paga.');
        END IF;

        -- Verificar se o valor da transação cobre a mensalidade
        IF v_transacao_importada.valor < v_mensalidade.valor THEN
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

    -- 4. Criar Lançamento Financeiro
    INSERT INTO public.financeiro_lancamentos (
        escola_id,
        aluno_id,
        matricula_id,
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
        data_vencimento
    ) VALUES (
        p_escola_id,
        p_aluno_id,
        COALESCE(v_mensalidade.matricula_id, (SELECT id FROM public.matriculas WHERE aluno_id = p_aluno_id AND escola_id = p_escola_id ORDER BY created_at DESC LIMIT 1)),
        'credito',
        'conciliacao_bancaria',
        'Pagamento conciliado: ' || v_transacao_importada.descricao || ' (' || v_transacao_importada.referencia || ')',
        v_transacao_importada.valor,
        NOW(), -- Data de registro do lançamento
        v_transacao_importada.banco,
        v_actor_id,
        EXTRACT(MONTH FROM v_transacao_importada.data),
        EXTRACT(YEAR FROM v_transacao_importada.data),
        'pago',
        v_transacao_importada.data
    ) RETURNING id INTO v_lancamento_id;

    -- 5. Atualizar Status da Transação Importada
    UPDATE public.financeiro_transacoes_importadas
    SET
        status = 'conciliado',
        aluno_match_details = jsonb_set(COALESCE(aluno_match_details, '{}'::jsonb), '{mensalidadeConciliadaId}', to_jsonb(p_mensalidade_id)),
        lancamento_id = v_lancamento_id,
        updated_at = NOW()
    WHERE id = p_transacao_id;

    -- 6. Log de Auditoria
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
        p_escola_id,
        v_actor_id,
        'CONCILIACAO_TRANSACAO_CONFIRMADA',
        'financeiro_transacoes_importadas',
        p_transacao_id::text,
        'financeiro',
        jsonb_build_object(
            'aluno_id', p_aluno_id,
            'mensalidade_id', p_mensalidade_id,
            'valor_transacao', v_transacao_importada.valor,
            'lancamento_id', v_lancamento_id
        )
    );

    RETURN jsonb_build_object('ok', TRUE, 'lancamento_id', v_lancamento_id);
END;
$function$;

COMMIT;
