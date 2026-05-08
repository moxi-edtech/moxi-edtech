-- Phase 4: Historical Occupancy for K12 Turmas Evolution
-- This RPC calculates monthly occupancy snapshots for a turma.

CREATE OR REPLACE FUNCTION get_turma_occupancy_history(p_turma_id UUID)
RETURNS TABLE (
    mes_referencia TEXT,
    total_alunos BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH meses AS (
        -- Generate last 12 months including current
        SELECT 
            TO_CHAR(date_trunc('month', NOW() - (interval '1 month' * m)), 'YYYY-MM') as mes
        FROM generate_series(0, 11) m
    )
    SELECT 
        m.mes,
        (
            SELECT COUNT(*)
            FROM public.matriculas mat
            WHERE mat.turma_id = p_turma_id
              AND mat.status IN ('ativa', 'ativo')
              -- Enrollment existed at the end of that month
              AND mat.created_at <= (date_trunc('month', (m.mes || '-01')::date) + interval '1 month - 1 day')::timestamp with time zone
        ) as total
    FROM meses m
    ORDER BY m.mes ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
