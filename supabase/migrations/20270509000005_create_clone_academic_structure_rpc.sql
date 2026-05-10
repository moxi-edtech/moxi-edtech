-- Migration: 20270509000005_create_clone_academic_structure_rpc.sql
-- Description: Create a robust RPC to clone classes and teacher assignments between academic years.

CREATE OR REPLACE FUNCTION public.clone_academic_structure(
    p_escola_id uuid, 
    p_from_ano_id uuid, 
    p_to_ano_id uuid,
    p_clone_professores boolean DEFAULT TRUE
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_to_ano_num int;
    v_turma_record record;
    v_new_turma_id uuid;
    v_cloned_count int := 0;
    v_actor_id uuid := auth.uid();
    v_escola_id uuid := public.current_tenant_escola_id();
    v_has_permission boolean;
BEGIN
    -- 1. Security Check
    IF v_escola_id IS NULL OR p_escola_id IS DISTINCT FROM v_escola_id THEN
        RAISE EXCEPTION 'AUTH: escola_id inválido.';
    END IF;
    SELECT public.user_has_role_in_school(v_escola_id, ARRAY['admin', 'admin_escola'])
    INTO v_has_permission;
    IF NOT v_has_permission THEN
        RAISE EXCEPTION 'AUTH: Permissão negada.';
    END IF;

    -- 2. Get Target Year Number
    SELECT ano INTO v_to_ano_num FROM public.anos_letivos WHERE id = p_to_ano_id AND escola_id = p_escola_id;
    IF v_to_ano_num IS NULL THEN
        RAISE EXCEPTION 'Ano de destino não encontrado.';
    END IF;

    -- 3. Loop through source classes
    FOR v_turma_record IN 
        SELECT * FROM public.turmas 
        WHERE escola_id = p_escola_id AND ano_letivo_id = p_from_ano_id
    LOOP
        -- Check if a similar class already exists in the target year to avoid duplicates
        -- Unique key: (escola_id, ano_letivo, classe_id, turno, nome)
        SELECT id INTO v_new_turma_id 
        FROM public.turmas 
        WHERE escola_id = p_escola_id 
          AND ano_letivo = v_to_ano_num 
          AND classe_id = v_turma_record.classe_id 
          AND turno = v_turma_record.turno 
          AND nome = v_turma_record.nome;

        IF v_new_turma_id IS NULL THEN
            -- Create new class
            INSERT INTO public.turmas (
                escola_id, nome, ano_letivo, turno, sala, 
                classe_id, curso_id, capacidade_maxima, 
                turma_codigo, status_validacao, ano_letivo_id
            )
            VALUES (
                p_escola_id, v_turma_record.nome, v_to_ano_num, v_turma_record.turno, v_turma_record.sala,
                v_turma_record.classe_id, v_turma_record.curso_id, v_turma_record.capacidade_maxima,
                v_turma_record.turma_codigo, v_turma_record.status_validacao, p_to_ano_id
            )
            RETURNING id INTO v_new_turma_id;
            
            v_cloned_count := v_cloned_count + 1;
        END IF;

        -- 4. Clone Teacher Assignments (TDP) if requested
        -- Note: The trigger 'tg_fill_turma_disciplinas' will automatically create the 'turma_disciplinas' rows.
        -- We just need to associate the professors to those subjects.
        IF p_clone_professores THEN
            -- Associate professors in turma_disciplinas_professores
            -- We match by disciplina_id (linked to the same curriculum/matriz)
            INSERT INTO public.turma_disciplinas_professores (
                escola_id, turma_id, disciplina_id, professor_id, horarios, planejamento
            )
            SELECT 
                p_escola_id, v_new_turma_id, tdp_old.disciplina_id, tdp_old.professor_id, tdp_old.horarios, tdp_old.planejamento
            FROM public.turma_disciplinas_professores tdp_old
            WHERE tdp_old.turma_id = v_turma_record.id
            ON CONFLICT (escola_id, turma_id, disciplina_id) DO UPDATE SET
                professor_id = EXCLUDED.professor_id,
                horarios = EXCLUDED.horarios,
                planejamento = EXCLUDED.planejamento;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', true, 
        'message', format('%s turmas e as suas atribuições foram clonadas com sucesso.', v_cloned_count),
        'total_cloned', v_cloned_count
    );
END;
$function$;
