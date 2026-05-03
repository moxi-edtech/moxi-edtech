BEGIN;

-- Function to emit certificates in batch for a cohort
CREATE OR REPLACE FUNCTION public.formacao_emitir_certificados_batch(
    p_escola_id uuid,
    p_cohort_id uuid,
    p_user_ids uuid[]
)
RETURNS TABLE (count bigint) AS $$
DECLARE
    v_inscricao record;
    v_emissao_count bigint := 0;
BEGIN
    -- Security check
    IF NOT public.can_access_formacao_backoffice(p_escola_id) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    -- Iterate over eligible students who are in the provided list
    FOR v_inscricao IN 
        SELECT vw.inscricao_id, vw.formando_user_id
        FROM public.vw_formacao_estudante_progresso vw
        WHERE vw.escola_id = p_escola_id
          AND vw.cohort_id = p_cohort_id
          AND vw.formando_user_id = ANY(p_user_ids)
          AND vw.elegivel_certificacao = true
          -- Don't emit if already emitted
          AND NOT EXISTS (
              SELECT 1 FROM public.formacao_certificados_emitidos ce 
              WHERE ce.cohort_id = p_cohort_id AND ce.formando_user_id = vw.formando_user_id
          )
    LOOP
        -- Simple emission logic: insert into certificates table
        INSERT INTO public.formacao_certificados_emitidos (
            escola_id,
            cohort_id,
            formando_user_id,
            numero_documento,
            emitido_em
        ) VALUES (
            p_escola_id,
            p_cohort_id,
            v_inscricao.formando_user_id,
            'CERT-' || p_cohort_id || '-' || v_inscricao.formando_user_id, -- Simplistic numbering
            now()
        );

        v_emissao_count := v_emissao_count + 1;
    END LOOP;

    RETURN QUERY SELECT v_emissao_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
