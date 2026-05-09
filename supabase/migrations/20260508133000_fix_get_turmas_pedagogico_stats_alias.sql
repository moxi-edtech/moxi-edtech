-- Fix runtime 500 in get_turmas_pedagogico_stats:
-- notas_stats CTE exposes count_disciplinas_criticas, but final SELECT referenced count_abaixo_notas.

CREATE OR REPLACE FUNCTION public.get_turmas_pedagogico_stats(p_escola_id uuid)
RETURNS TABLE(
  turma_id uuid,
  media_presenca numeric,
  media_notas numeric,
  alunos_abaixo_presenca bigint,
  alunos_abaixo_notas bigint,
  is_desescoberta boolean,
  decomposicao_saude jsonb,
  candidatos_espera bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_active_periodo_id uuid;
  v_day_of_week int := EXTRACT(DOW FROM NOW());
BEGIN
  IF v_day_of_week = 0 THEN
    v_day_of_week := 7;
  END IF;

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
      AVG(fsp.percentual_presenca) AS avg_presenca,
      COUNT(*) FILTER (WHERE fsp.abaixo_minimo) AS count_abaixo_presenca
    FROM frequencia_status_periodo fsp
    WHERE fsp.escola_id = p_escola_id
      AND (v_active_periodo_id IS NULL OR fsp.periodo_letivo_id = v_active_periodo_id)
    GROUP BY fsp.turma_id
  ),
  notas_stats AS (
    SELECT
      ap.turma_id,
      AVG(ap.media_geral) AS avg_notas,
      COUNT(DISTINCT ap.disciplina_id) FILTER (WHERE ap.media_geral < 50) AS count_disciplinas_criticas
    FROM aggregates_pedagogico ap
    WHERE ap.escola_id = p_escola_id
      AND (v_active_periodo_id IS NULL OR ap.periodo_letivo_id = v_active_periodo_id)
    GROUP BY ap.turma_id
  ),
  desescoberta_stats AS (
    SELECT
      t.id AS t_id,
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
      ) AS t_is_desescoberta
    FROM turmas t
    WHERE t.escola_id = p_escola_id
  ),
  candidaturas_stats AS (
    SELECT
      c.turma_preferencial_id,
      COUNT(*) AS count_espera
    FROM candidaturas c
    WHERE c.escola_id = p_escola_id
      AND c.status NOT IN ('matriculado', 'convertida', 'arquivado', 'rejeitado', 'rascunho')
      AND c.turma_preferencial_id IS NOT NULL
    GROUP BY c.turma_preferencial_id
  )
  SELECT
    t.id,
    COALESCE(ps.avg_presenca, 100)::numeric,
    COALESCE(ns.avg_notas, 0)::numeric,
    COALESCE(ps.count_abaixo_presenca, 0)::bigint,
    COALESCE(ns.count_disciplinas_criticas, 0)::bigint,
    COALESCE(ds.t_is_desescoberta, false),
    jsonb_build_object(
      'presenca_media', ROUND(COALESCE(ps.avg_presenca, 100)::numeric, 1),
      'notas_media', ROUND(COALESCE(ns.avg_notas, 0)::numeric, 1),
      'alunos_abaixo_presenca', COALESCE(ps.count_abaixo_presenca, 0),
      'disciplinas_abaixo_media', COALESCE(ns.count_disciplinas_criticas, 0),
      'periodo_referencia', v_active_periodo_id,
      'is_desescoberta', COALESCE(ds.t_is_desescoberta, false),
      'candidatos_espera', COALESCE(cs.count_espera, 0)
    ),
    COALESCE(cs.count_espera, 0)::bigint
  FROM turmas t
  LEFT JOIN presenca_stats ps ON ps.turma_id = t.id
  LEFT JOIN notas_stats ns ON ns.turma_id = t.id
  LEFT JOIN desescoberta_stats ds ON ds.t_id = t.id
  LEFT JOIN candidaturas_stats cs ON cs.turma_preferencial_id = t.id
  WHERE t.escola_id = p_escola_id;
END;
$function$;
