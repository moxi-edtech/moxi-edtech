-- Phase 4: Admissions Funnel Integration for K12 Turmas Evolution
-- This migration updates the get_turmas_pedagogico_stats RPC to include candidates waiting for enrollment.

CREATE OR REPLACE FUNCTION get_turmas_pedagogico_stats(p_escola_id UUID)
RETURNS TABLE (
    turma_id UUID,
    media_presenca NUMERIC,
    media_notas NUMERIC,
    alunos_abaixo_presenca BIGINT,
    alunos_abaixo_notas BIGINT,
    is_desescoberta BOOLEAN,
    decomposicao_saude JSONB,
    candidatos_espera BIGINT
) AS $$
DECLARE
    v_active_periodo_id UUID;
    v_now TIMESTAMP := NOW();
    v_day_of_week INT := EXTRACT(DOW FROM NOW()); 
BEGIN
    -- Map DOW: PostgreSQL 0 (Sun) to 6 (Sat). Our DB uses 1 (Mon) to 7 (Sun).
    IF v_day_of_week = 0 THEN 
        v_day_of_week := 7; 
    END IF;

    -- Get active period letivo for the school
    SELECT id INTO v_active_periodo_id
    FROM periodos_letivos
    WHERE escola_id = p_escola_id
      AND data_inicio <= CURRENT_DATE
      AND data_fim >= CURRENT_DATE
    ORDER BY data_inicio DESC
    LIMIT 1;

    RETURN QUERY
    WITH presenca_stats AS (
        SELECT 
            fsp.turma_id,
            AVG(fsp.percentual_presenca) as avg_presenca,
            COUNT(*) FILTER (WHERE fsp.abaixo_minimo) as count_abaixo_presenca
        FROM frequencia_status_periodo fsp
        WHERE fsp.escola_id = p_escola_id
          AND (v_active_periodo_id IS NULL OR fsp.periodo_letivo_id = v_active_periodo_id)
        GROUP BY fsp.turma_id
    ),
    notas_stats AS (
        -- Aggregate grades across all disciplines for each turma
        SELECT 
            ap.turma_id,
            AVG(ap.media_geral) as avg_notas,
            COUNT(DISTINCT ap.disciplina_id) FILTER (WHERE ap.media_geral < 50) as count_disciplinas_criticas -- Disciplines where class average < 50
        FROM aggregates_pedagogico ap
        WHERE ap.escola_id = p_escola_id
          AND (v_active_periodo_id IS NULL OR ap.periodo_letivo_id = v_active_periodo_id)
        GROUP BY ap.turma_id
    ),
    desescoberta_stats AS (
        -- Check if there is an active slot in published schedule without professor
        SELECT 
            t.id as t_id,
            EXISTS (
                SELECT 1
                FROM horario_slots s
                JOIN horario_versoes v ON v.turma_id = t.id AND v.status = 'publicada'
                LEFT JOIN quadro_horarios q ON q.slot_id = s.id AND q.versao_id = v.id
                WHERE s.escola_id = p_escola_id
                  AND s.turno_id = (
                      CASE t.turno 
                        WHEN 'M' THEN 'matinal'
                        WHEN 'T' THEN 'tarde'
                        WHEN 'N' THEN 'noturno'
                        ELSE NULL
                      END
                  )
                  AND s.dia_semana = v_day_of_week
                  AND CURRENT_TIME BETWEEN s.inicio AND s.fim
                  AND (q.professor_id IS NULL OR q.id IS NULL)
            ) as t_is_desescoberta
        FROM turmas t
        WHERE t.escola_id = p_escola_id
    ),
    candidaturas_stats AS (
        -- Count candidates waiting for enrollment in this specific turma
        SELECT 
            c.turma_preferencial_id,
            COUNT(*) as count_espera
        FROM candidaturas c
        WHERE c.escola_id = p_escola_id
          AND c.status NOT IN ('matriculado', 'convertida', 'arquivado', 'rejeitado', 'rascunho')
          AND c.turma_preferencial_id IS NOT NULL
        GROUP BY c.turma_preferencial_id
    )
    SELECT 
        t.id,
        COALESCE(ps.avg_presenca, 100)::NUMERIC,
        COALESCE(ns.avg_notas, 0)::NUMERIC,
        COALESCE(ps.count_abaixo_presenca, 0)::BIGINT,
        COALESCE(ns.count_abaixo_notas, 0)::BIGINT,
        COALESCE(ds.t_is_desescoberta, false),
        jsonb_build_object(
            'presenca_media', ROUND(COALESCE(ps.avg_presenca, 100)::numeric, 1),
            'notas_media', ROUND(COALESCE(ns.avg_notas, 0)::numeric, 1),
            'alunos_abaixo_presenca', COALESCE(ps.count_abaixo_presenca, 0),
            'disciplinas_abaixo_media', COALESCE(ns.count_abaixo_notas, 0),
            'periodo_referencia', v_active_periodo_id,
            'is_desescoberta', COALESCE(ds.t_is_desescoberta, false),
            'candidatos_espera', COALESCE(cs.count_espera, 0)
        ),
        COALESCE(cs.count_espera, 0)::BIGINT
    FROM turmas t
    LEFT JOIN presenca_stats ps ON ps.turma_id = t.id
    LEFT JOIN notas_stats ns ON ns.turma_id = t.id
    LEFT JOIN desescoberta_stats ds ON ds.t_id = t.id
    LEFT JOIN candidaturas_stats cs ON cs.turma_preferencial_id = t.id
    WHERE t.escola_id = p_escola_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
