-- Migration: 20260510000010_rpc_cutover_ano_letivo.sql
-- Descrição: RPC Suprema para Virada Atômica de Ano Letivo.
-- Objetivo: Garantir integridade total na transição, unindo Snapshot, Switch e Rematrícula.

BEGIN;

CREATE OR REPLACE FUNCTION public.cutover_ano_letivo_v1(
    p_escola_id uuid,
    p_from_session_id uuid,
    p_to_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_permission boolean;
    v_escola_id uuid := public.current_tenant_escola_id();
    
    v_pendentes_pauta int;
    v_total_matriculas_processadas int := 0;
    v_resumo_rematricula jsonb := '{}'::jsonb;
    v_actor_id uuid := auth.uid();
BEGIN
    -- 1. Validação de Contexto e Permissão
    IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
        RAISE EXCEPTION 'AUTH: escola_id inválido.';
    END IF;
    
    SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
    INTO v_has_permission;
    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'AUTH: Permissão negada.';
    END IF;

    -- 2. Check-up de Prontidão (Garantia de 100% Pautas)
    SELECT count(*) INTO v_pendentes_pauta
    FROM public.turmas t
    WHERE t.escola_id = v_escola_id AND t.session_id = p_from_session_id
    AND NOT EXISTS (
        SELECT 1 FROM public.pautas_oficiais po 
        WHERE po.turma_id = t.id AND po.status = 'SUCCESS' AND po.tipo = 'anual'
    );

    IF v_pendentes_pauta > 0 THEN
        RAISE EXCEPTION 'PREREQUISITE_FAILED: Existem % turmas sem pauta anual oficial gerada.', v_pendentes_pauta;
    END IF;

    -- 3. LOCK OPERACIONAL: Desativa ano antigo, Ativa ano novo
    UPDATE public.anos_letivos SET ativo = false WHERE escola_id = v_escola_id;
    UPDATE public.anos_letivos SET ativo = true WHERE id = p_to_session_id AND escola_id = v_escola_id;

    -- 4. REMATRÍCULA EM MASSA (Lógica SSOT baseada em Ledger e Pauta)
    -- Para cada turma de origem, buscamos a de destino (mesmo nome/turno/classe no novo ano)
    FOR v_resumo_rematricula IN 
        SELECT jsonb_strip_nulls(jsonb_agg(rem.res))
        FROM (
            SELECT public.rematricula_em_massa(v_escola_id, t_old.id, t_new.id) as res
            FROM public.turmas t_old
            JOIN public.turmas t_new ON 
                t_new.nome = t_old.nome AND 
                t_new.turno = t_old.turno AND 
                t_new.curso_id = t_old.curso_id AND 
                t_new.classe_id = (
                    -- Promoção inteligente: 10ªA -> 11ªA
                    SELECT id FROM public.classes cl_dest 
                    WHERE cl_dest.escola_id = v_escola_id 
                    AND cl_dest.nivel = t_old.classe_num + 1 -- Assume-se classe_num incremental
                    LIMIT 1
                )
            WHERE t_old.session_id = p_from_session_id AND t_new.session_id = p_to_session_id
        ) rem
    LOOP
        -- Processamento opcional do loop
    END LOOP;

    -- 5. Snapshot Final de Histórico
    -- Chama a lógica existente de snapshot para garantir que o passado seja imutável
    PERFORM public.historico_set_snapshot_state(v_escola_id, p_from_session_id, 'LOCKED');

    -- 6. Auditoria Central de Virada
    INSERT INTO public.audit_logs (escola_id, actor_id, action, entity, entity_id, details, portal)
    VALUES (
        v_escola_id,
        v_actor_id,
        'ANO_LETIVO_CUTOVER_SUCCESS',
        'escola',
        v_escola_id::text,
        jsonb_build_object(
            'from_session_id', p_from_session_id,
            'to_session_id', p_to_session_id,
            'timestamp', now()
        ),
        'admin'
    );

    RETURN jsonb_build_object(
        'ok', true,
        'message', 'Virada de ano letivo concluída com sucesso. Alunos aptos foram promovidos.',
        'resumo', v_resumo_rematricula
    );
END;
$$;

COMMIT;
