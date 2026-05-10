-- Migration: 20260510000007_rpc_fix_academic_session_ids.sql
-- Descrição: RPC para corrigir automaticamente turmas e matrículas sem session_id.
-- Objetivo: Baixa fricção no Wizard de Virada, permitindo resolver nulos em um clique.

BEGIN;

CREATE OR REPLACE FUNCTION public.fix_academic_session_ids(p_escola_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fixed_turmas int := 0;
    v_fixed_matriculas int := 0;
    v_has_permission boolean;
    v_escola_id uuid := public.current_tenant_escola_id();
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

    -- 2. Corrigir Turmas
    -- Prioridade 1: Usar ano_letivo_id se populado
    WITH upd_t1 AS (
        UPDATE public.turmas
        SET session_id = ano_letivo_id
        WHERE escola_id = v_escola_id AND session_id IS NULL AND ano_letivo_id IS NOT NULL
        RETURNING 1
    ) SELECT count(*) INTO v_fixed_turmas FROM upd_t1;

    -- Prioridade 2: Mapear via tabela anos_letivos se apenas ano existir
    WITH upd_t2 AS (
        UPDATE public.turmas t
        SET session_id = al.id
        FROM public.anos_letivos al
        WHERE t.escola_id = v_escola_id 
          AND t.session_id IS NULL 
          AND al.escola_id = t.escola_id 
          AND al.ano::text = t.ano_letivo::text
        RETURNING 1
    ) SELECT v_fixed_turmas + count(*) INTO v_fixed_turmas FROM upd_t2;

    -- 3. Corrigir Matrículas
    -- Prioridade 1: Mapear via turma_id (SSOT geográfico-temporal)
    WITH upd_m1 AS (
        UPDATE public.matriculas m
        SET session_id = t.session_id
        FROM public.turmas t
        WHERE m.escola_id = v_escola_id 
          AND m.session_id IS NULL 
          AND t.id = m.turma_id
          AND t.session_id IS NOT NULL
        RETURNING 1
    ) SELECT count(*) INTO v_fixed_matriculas FROM upd_m1;

    -- Prioridade 2: Mapear via ano_letivo (texto/int) direto para anos_letivos
    WITH upd_m2 AS (
        UPDATE public.matriculas m
        SET session_id = al.id
        FROM public.anos_letivos al
        WHERE m.escola_id = v_escola_id 
          AND m.session_id IS NULL 
          AND al.escola_id = m.escola_id 
          AND al.ano::text = m.ano_letivo::text
        RETURNING 1
    ) SELECT v_fixed_matriculas + count(*) INTO v_fixed_matriculas FROM upd_m2;

    -- 4. Auditoria
    INSERT INTO public.audit_logs (escola_id, action, entity, details, portal)
    VALUES (v_escola_id, 'FIX_ACADEMIC_SESSIONS', 'multiple', jsonb_build_object('fixed_turmas', v_fixed_turmas, 'fixed_matriculas', v_fixed_matriculas), 'admin');

    RETURN jsonb_build_object(
        'ok', true,
        'fixed_turmas', v_fixed_turmas,
        'fixed_matriculas', v_fixed_matriculas
    );
END;
$$;

COMMIT;
