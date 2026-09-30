-- O fluxo do portal não deve ficar indisponível quando a migration opcional de
-- updated_at ainda não estiver presente no ambiente remoto.
CREATE OR REPLACE FUNCTION public.aluno_submeter_comprovativo_servico(
    p_pagamento_intent_id uuid,
    p_evidence_url text,
    p_mensagem text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id uuid := auth.uid();
    v_escola_id uuid := public.current_tenant_escola_id();
    v_intent record;
BEGIN
    IF v_actor_id IS NULL OR v_escola_id IS NULL THEN
        RAISE EXCEPTION 'AUTH: Não autenticado ou escola não resolvida.';
    END IF;

    SELECT * INTO v_intent
    FROM public.pagamento_intents
    WHERE id = p_pagamento_intent_id AND escola_id = v_escola_id;

    IF v_intent.id IS NULL THEN
        RAISE EXCEPTION 'DATA: Solicitação não encontrada.';
    END IF;

    IF NOT public.portal_user_can_access_aluno(v_intent.aluno_id) THEN
        RAISE EXCEPTION 'AUTH: Você não tem permissão para este recurso.';
    END IF;

    IF v_intent.status IN ('settled', 'paid') THEN
        RAISE EXCEPTION 'STATE: Esta solicitação já está paga e concluída.';
    END IF;

    UPDATE public.pagamento_intents
    SET status = 'pending',
        evidence_url = p_evidence_url,
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'submitted_at', now(),
          'mensagem_aluno', NULLIF(trim(p_mensagem), '')
        )
    WHERE id = p_pagamento_intent_id;

    RETURN jsonb_build_object(
        'ok', true,
        'status', 'pending',
        'message', 'Comprovativo submetido com sucesso. Aguarde a validação da secretaria.'
    );
END;
$$;
