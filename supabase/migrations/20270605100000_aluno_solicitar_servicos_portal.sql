-- 1. Permissões de Leitura para Alunos
CREATE POLICY "Alunos podem ver seus próprios pedidos de serviço"
    ON public.servico_pedidos
    FOR SELECT
    TO authenticated
    USING (aluno_id IN (
        SELECT id FROM public.alunos WHERE usuario_auth_id = auth.uid() OR profile_id = auth.uid()
    ));

CREATE POLICY "Alunos podem ver suas próprias intenções de pagamento"
    ON public.pagamento_intents
    FOR SELECT
    TO authenticated
    USING (aluno_id IN (
        SELECT id FROM public.alunos WHERE usuario_auth_id = auth.uid() OR profile_id = auth.uid()
    ));

-- 2. RPC para Solicitação de Serviço pelo Aluno
CREATE OR REPLACE FUNCTION public.aluno_solicitar_servico(
    p_escola_id uuid,
    p_aluno_id uuid,
    p_servico_codigo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_serv record;
    v_matricula_id uuid;
    v_pedido_id uuid;
    v_pagamento_id uuid;
    v_status text;
BEGIN
    -- 1. Validar se o aluno pertence ao usuário logado
    IF NOT EXISTS (
        SELECT 1 FROM public.alunos 
        WHERE id = p_aluno_id 
        AND (usuario_auth_id = v_actor_id OR profile_id = v_actor_id)
    ) THEN
        RAISE EXCEPTION 'AUTH: Você não tem permissão para solicitar serviços para este aluno.';
    END IF;

    -- 2. Obter o serviço do catálogo
    SELECT * INTO v_serv FROM public.servicos_escola 
    WHERE escola_id = p_escola_id AND codigo = p_servico_codigo AND ativo = true;

    IF v_serv.id IS NULL THEN
        RAISE EXCEPTION 'DATA: Serviço não encontrado ou inativo.';
    END IF;

    -- 3. Obter matrícula atual
    SELECT id INTO v_matricula_id FROM public.matriculas 
    WHERE aluno_id = p_aluno_id AND escola_id = p_escola_id AND status = 'ativo'
    ORDER BY created_at DESC LIMIT 1;

    -- 4. Verificar se já existe um pedido idêntico não finalizado (evitar duplicados)
    SELECT id, status INTO v_pedido_id, v_status FROM public.servico_pedidos
    WHERE aluno_id = p_aluno_id AND servico_codigo = p_servico_codigo AND status IN ('pending_payment', 'blocked')
    LIMIT 1;

    IF v_pedido_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', true,
            'message', 'Você já possui uma solicitação em andamento para este documento.',
            'pedido_id', v_pedido_id,
            'status', v_status
        );
    END IF;

    -- 5. Definir status inicial
    -- Se não exige pagamento, libera direto ou manda pra aprovação
    IF v_serv.valor_base = 0 AND NOT v_serv.exige_aprovacao THEN
        v_status := 'granted';
    ELSIF v_serv.valor_base > 0 THEN
        v_status := 'pending_payment';
    ELSE
        v_status := 'blocked'; -- Aguardando aprovação manual
    END IF;

    -- 6. Criar o Pedido
    INSERT INTO public.servico_pedidos (
        escola_id, aluno_id, matricula_id, servico_escola_id, 
        status, servico_codigo, servico_nome, valor_cobrado, 
        created_by
    ) VALUES (
        p_escola_id, p_aluno_id, v_matricula_id, v_serv.id,
        v_status, v_serv.codigo, v_serv.nome, v_serv.valor_base,
        v_actor_id
    ) RETURNING id INTO v_pedido_id;

    -- 7. Se for pago, criar a intenção de pagamento
    IF v_serv.valor_base > 0 THEN
        INSERT INTO public.pagamento_intents (
            escola_id, aluno_id, servico_pedido_id, amount,
            status, method, created_by
        ) VALUES (
            p_escola_id, p_aluno_id, v_pedido_id, v_serv.valor_base,
            'draft', 'transfer', v_actor_id
        ) RETURNING id INTO v_pagamento_id;
    END IF;

    -- 8. Auditoria
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, portal, details)
    VALUES (
        p_escola_id, v_actor_id, 'SERVICO_SOLICITADO_ALUNO', 'servico_pedidos', 
        v_pedido_id::text, 'aluno', 
        jsonb_build_object('servico', p_servico_codigo, 'valor', v_serv.valor_base)
    );

    RETURN jsonb_build_object(
        'ok', true,
        'pedido_id', v_pedido_id,
        'pagamento_id', v_pagamento_id,
        'status', v_status,
        'valor', v_serv.valor_base
    );
END;
$$;
