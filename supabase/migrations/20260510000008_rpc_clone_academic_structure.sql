-- Migration: 20260510000008_rpc_clone_academic_structure.sql
-- Descrição: RPC para clonagem atômica da estrutura acadêmica e financeira entre anos letivos.
-- Objetivo: Baixa fricção para o Diretor Pedagógico, garantindo isolamento entre anos.

BEGIN;

-- 1. Evolução do Schema Financeiro para SSOT
-- Adicionando session_id para alinhar com o novo contrato de tempo.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_tabelas' AND column_name = 'session_id') THEN
        ALTER TABLE public.financeiro_tabelas ADD COLUMN session_id uuid REFERENCES public.anos_letivos(id);
    END IF;
END $$;

-- 2. RPC Suprema de Clonagem
CREATE OR REPLACE FUNCTION public.clone_academic_structure_v1(
    p_escola_id uuid,
    p_from_session_id uuid,
    p_to_session_id uuid,
    p_readjust_percent numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_to_ano int;
    v_from_ano int;
    v_has_permission boolean;
    v_escola_id uuid := public.current_tenant_escola_id();
    
    v_count_periodos int := 0;
    v_count_precos int := 0;
    v_count_turmas int := 0;
    v_count_disciplinas int := 0;
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

    -- 2. Validar Sessões
    SELECT ano INTO v_from_ano FROM public.anos_letivos WHERE id = p_from_session_id AND escola_id = v_escola_id;
    SELECT ano INTO v_to_ano FROM public.anos_letivos WHERE id = p_to_session_id AND escola_id = v_escola_id;

    IF v_from_ano IS NULL OR v_to_ano IS NULL THEN
        RAISE EXCEPTION 'DATA: Sessões de origem ou destino não encontradas.';
    END IF;

    IF v_from_ano >= v_to_ano THEN
        RAISE EXCEPTION 'LOGIC: A sessão de destino deve ser cronologicamente posterior à de origem.';
    END IF;

    -- 3. Clonar Períodos Letivos
    WITH ins_periods AS (
        INSERT INTO public.periodos_letivos (escola_id, ano_letivo_id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso)
        SELECT 
            escola_id, 
            p_to_session_id, 
            tipo, 
            numero, 
            data_inicio + interval '1 year', 
            data_fim + interval '1 year', 
            null, 
            peso
        FROM public.periodos_letivos
        WHERE escola_id = v_escola_id AND ano_letivo_id = p_from_session_id
        ON CONFLICT (escola_id, ano_letivo_id, tipo, numero) DO NOTHING
        RETURNING 1
    ) SELECT count(*) INTO v_count_periodos FROM ins_periods;

    -- 4. Clonar Tabela de Preços (Financeiro)
    WITH ins_prices AS (
        INSERT INTO public.financeiro_tabelas (
            escola_id, curso_id, classe_id, ano_letivo, session_id, 
            valor_matricula, valor_mensalidade, dia_vencimento, multa_diaria, multa_atraso_percentual
        )
        SELECT 
            escola_id, curso_id, classe_id, v_to_ano, p_to_session_id,
            valor_matricula * (1 + p_readjust_percent / 100),
            valor_mensalidade * (1 + p_readjust_percent / 100),
            dia_vencimento, multa_diaria, multa_atraso_percentual
        FROM public.financeiro_tabelas
        WHERE escola_id = v_escola_id AND (session_id = p_from_session_id OR ano_letivo = v_from_ano)
        ON CONFLICT (escola_id, classe_id, curso_id, ano_letivo) DO NOTHING
        RETURNING 1
    ) SELECT count(*) INTO v_count_precos FROM ins_prices;

    -- 5. Clonar Turmas (Estrutura Vazia)
    -- Usamos uma tabela temporária para mapear IDs antigos para novos
    CREATE TEMP TABLE map_turmas (old_id uuid, new_id uuid);

    WITH ins_turmas AS (
        INSERT INTO public.turmas (
            escola_id, curso_id, classe_id, ano_letivo, session_id, ano_letivo_id,
            nome, turno, capacidade_maxima, status_validacao, letra, sala
        )
        SELECT 
            escola_id, curso_id, classe_id, v_to_ano, p_to_session_id, p_to_session_id,
            nome, turno, capacidade_maxima, 'ativo', letra, sala
        FROM public.turmas
        WHERE escola_id = v_escola_id AND session_id = p_from_session_id
        ON CONFLICT (escola_id, curso_id, classe_id, ano_letivo, nome, turno) DO NOTHING
        RETURNING id, nome, curso_id, classe_id, turno -- Precisamos de algo para cruzar de volta
    ) 
    INSERT INTO map_turmas (old_id, new_id)
    SELECT t_old.id, t_new.id
    FROM public.turmas t_old
    JOIN ins_turmas t_new ON 
        t_new.nome = t_old.nome AND 
        t_new.turno = t_old.turno AND 
        t_new.curso_id = t_old.curso_id AND 
        t_new.classe_id = t_old.classe_id
    WHERE t_old.session_id = p_from_session_id;

    SELECT count(*) INTO v_count_turmas FROM map_turmas;

    -- 6. Clonar Vínculos de Disciplinas (Turma Disciplinas)
    WITH ins_td AS (
        INSERT INTO public.turma_disciplinas (
            escola_id, turma_id, curso_matriz_id, professor_id, carga_horaria_semanal, 
            modelo_avaliacao_id, periodos_ativos, conta_para_media_med, classificacao,
            avaliacao_mode, avaliacao_disciplina_id
        )
        SELECT 
            td.escola_id, m.new_id, td.curso_matriz_id, td.professor_id, td.carga_horaria_semanal,
            td.modelo_avaliacao_id, td.periodos_ativos, td.conta_para_media_med, td.classificacao,
            td.avaliacao_mode, td.avaliacao_disciplina_id
        FROM public.turma_disciplinas td
        JOIN map_turmas m ON m.old_id = td.turma_id
        WHERE td.escola_id = v_escola_id
        ON CONFLICT (turma_id, disciplina_id) DO NOTHING -- Caso a constraint seja por esses campos
        RETURNING 1
    ) SELECT count(*) INTO v_count_disciplinas FROM ins_td;

    -- 7. Auditoria
    INSERT INTO public.audit_logs (escola_id, action, entity, portal, details)
    VALUES (
        v_escola_id, 
        'CLONE_ACADEMIC_STRUCTURE', 
        'multiple', 
        'admin', 
        jsonb_build_object(
            'from_session_id', p_from_session_id,
            'to_session_id', p_to_session_id,
            'readjust_percent', p_readjust_percent,
            'periodos_clonados', v_count_periodos,
            'precos_clonados', v_count_precos,
            'turmas_clonadas', v_count_turmas,
            'disciplinas_clonadas', v_count_disciplinas
        )
    );

    RETURN jsonb_build_object(
        'ok', true,
        'summary', jsonb_build_object(
            'periodos', v_count_periodos,
            'precos', v_count_precos,
            'turmas', v_count_turmas,
            'disciplinas', v_count_disciplinas
        )
    );
END;
$$;

COMMIT;
