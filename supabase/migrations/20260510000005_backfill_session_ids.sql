-- Migration: 20260510000005_backfill_session_ids.sql
-- Descrição: Backfill de session_id para turmas e matrículas.
-- Objetivo: Garantir que session_id seja o SSOT temporal, eliminando nulos.

BEGIN;

-- 1. DIAGNÓSTICO PRÉ-BACKFILL (Audit Trail)
-- Esta seção apenas gera logs/mensagens se rodada manualmente.
DO $$
DECLARE
    v_nulos_turmas int;
    v_nulos_matriculas int;
BEGIN
    SELECT count(*) INTO v_nulos_turmas FROM public.turmas WHERE session_id IS NULL;
    SELECT count(*) INTO v_nulos_matriculas FROM public.matriculas WHERE session_id IS NULL;
    
    RAISE NOTICE 'Diagnóstico: % turmas e % matrículas com session_id nulo.', v_nulos_turmas, v_nulos_matriculas;
END $$;

-- 2. BACKFILL TURMAS
-- Prioridade 1: Usar ano_letivo_id se populado
UPDATE public.turmas
SET session_id = ano_letivo_id
WHERE session_id IS NULL AND ano_letivo_id IS NOT NULL;

-- Prioridade 2: Mapear via tabela anos_letivos se apenas ano (int/text) existir
UPDATE public.turmas t
SET session_id = al.id
FROM public.anos_letivos al
WHERE t.session_id IS NULL 
  AND al.escola_id = t.escola_id 
  AND al.ano::text = t.ano_letivo::text;

-- 3. BACKFILL MATRÍCULAS
-- Prioridade 1: Mapear via turma_id (SSOT geográfico-temporal)
UPDATE public.matriculas m
SET session_id = t.session_id
FROM public.turmas t
WHERE m.session_id IS NULL 
  AND t.id = m.turma_id
  AND t.session_id IS NOT NULL;

-- Prioridade 2: Mapear via ano_letivo (texto/int) direto para anos_letivos
UPDATE public.matriculas m
SET session_id = al.id
FROM public.anos_letivos al
WHERE m.session_id IS NULL 
  AND al.escola_id = m.escola_id 
  AND al.ano::text = m.ano_letivo::text;

-- 4. VALIDAÇÃO PÓS-BACKFILL
DO $$
DECLARE
    v_nulos_turmas int;
    v_nulos_matriculas int;
BEGIN
    SELECT count(*) INTO v_nulos_turmas FROM public.turmas WHERE session_id IS NULL;
    SELECT count(*) INTO v_nulos_matriculas FROM public.matriculas WHERE session_id IS NULL;
    
    IF v_nulos_turmas > 0 OR v_nulos_matriculas > 0 THEN
        RAISE WARNING 'Atenção: Ainda restam % turmas e % matrículas com session_id nulo (sem mapeamento possível).', v_nulos_turmas, v_nulos_matriculas;
    ELSE
        RAISE NOTICE 'Sucesso: Backfill de session_id concluído com 100%% de cobertura.';
    END IF;
END $$;

COMMIT;
