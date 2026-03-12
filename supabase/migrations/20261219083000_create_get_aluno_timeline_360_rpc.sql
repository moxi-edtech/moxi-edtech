CREATE OR REPLACE FUNCTION public.get_aluno_timeline_360(
  p_escola_id uuid,
  p_aluno_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH matriculas_ranked AS (
  SELECT
    m.id,
    m.escola_id,
    m.aluno_id,
    m.ano_letivo,
    m.numero_matricula,
    m.status,
    m.data_matricula,
    ROW_NUMBER() OVER (
      PARTITION BY m.escola_id, m.aluno_id, m.ano_letivo
      ORDER BY m.data_matricula DESC NULLS LAST, m.created_at DESC NULLS LAST, m.id DESC
    ) AS rn
  FROM public.matriculas m
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
    AND m.ano_letivo IS NOT NULL
),
matriculas_base AS (
  SELECT
    id,
    ano_letivo,
    numero_matricula,
    status,
    data_matricula
  FROM matriculas_ranked
  WHERE rn = 1
),
anos_base AS (
  SELECT DISTINCT ano_letivo
  FROM (
    SELECT mb.ano_letivo FROM matriculas_base mb
    UNION ALL
    SELECT ha.ano_letivo
    FROM public.historico_anos ha
    WHERE ha.escola_id = p_escola_id
      AND ha.aluno_id = p_aluno_id
      AND ha.ano_letivo IS NOT NULL
    UNION ALL
    SELECT m.ano_referencia
    FROM public.mensalidades m
    WHERE m.escola_id = p_escola_id
      AND m.aluno_id = p_aluno_id
      AND m.ano_referencia IS NOT NULL
  ) years
),
anos_enriquecidos AS (
  SELECT
    ab.ano_letivo,
    al.id AS ano_letivo_id,
    mb.id AS matricula_id,
    mb.numero_matricula,
    mb.status AS status_matricula,
    mb.data_matricula
  FROM anos_base ab
  LEFT JOIN matriculas_base mb
    ON mb.ano_letivo = ab.ano_letivo
  LEFT JOIN LATERAL (
    SELECT a.id
    FROM public.anos_letivos a
    WHERE a.escola_id = p_escola_id
      AND a.ano = ab.ano_letivo
    ORDER BY a.ativo DESC, a.updated_at DESC NULLS LAST, a.created_at DESC, a.id DESC
    LIMIT 1
  ) al ON TRUE
),
academico AS (
  SELECT
    ha.ano_letivo,
    ROUND(AVG(COALESCE(ha.media_geral, hd.nota_media_ano))::numeric, 2) AS media_geral,
    (
      ARRAY_AGG(ha.resultado_final ORDER BY ha.data_fechamento DESC NULLS LAST, ha.id DESC)
    )[1] AS estado_final,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'disciplina_id', kd.disciplina_id,
          'disciplina_nome', kd.disciplina_nome,
          'media_final', kd.media_final,
          'resultado', kd.resultado,
          'em_risco', kd.em_risco
        )
        ORDER BY kd.prioridade, kd.media_final DESC NULLS LAST, kd.disciplina_nome
      ) FILTER (WHERE kd.disciplina_id IS NOT NULL),
      '[]'::jsonb
    ) AS disciplinas_chave
  FROM public.historico_anos ha
  LEFT JOIN LATERAL (
    SELECT AVG(hd.nota_final) AS nota_media_ano
    FROM public.historico_disciplinas hd
    WHERE hd.historico_ano_id = ha.id
  ) hd ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      hdx.disciplina_id,
      hdx.disciplina_nome,
      ROUND(hdx.nota_final::numeric, 2) AS media_final,
      hdx.status_final AS resultado,
      COALESCE(hdx.nota_final, 0) < 10 OR COALESCE(LOWER(hdx.status_final), '') LIKE '%reprov%' AS em_risco,
      CASE
        WHEN LOWER(COALESCE(hdx.disciplina_nome, '')) LIKE '%portug%' THEN 1
        WHEN LOWER(COALESCE(hdx.disciplina_nome, '')) LIKE '%matem%' THEN 2
        WHEN LOWER(COALESCE(hdx.disciplina_nome, '')) LIKE '%fisic%' THEN 3
        WHEN LOWER(COALESCE(hdx.disciplina_nome, '')) LIKE '%quim%' THEN 4
        WHEN LOWER(COALESCE(hdx.disciplina_nome, '')) LIKE '%biolog%' THEN 5
        ELSE 99
      END AS prioridade
    FROM public.historico_disciplinas hdx
    WHERE hdx.historico_ano_id = ha.id
    ORDER BY prioridade, hdx.nota_final DESC NULLS LAST, hdx.disciplina_nome
    LIMIT 8
  ) kd ON TRUE
  WHERE ha.escola_id = p_escola_id
    AND ha.aluno_id = p_aluno_id
  GROUP BY ha.ano_letivo
),
presenca_snapshot AS (
  SELECT
    m.ano_letivo,
    SUM(fsp.faltas) AS faltas,
    SUM(fsp.presencas) AS presencas,
    SUM(fsp.aulas_previstas) AS aulas_previstas,
    ROUND(AVG(fsp.frequencia_min_percent)::numeric, 2) AS frequencia_min_percent
  FROM public.frequencia_status_periodo fsp
  INNER JOIN public.matriculas m
    ON m.id = fsp.matricula_id
   AND m.escola_id = p_escola_id
   AND m.aluno_id = p_aluno_id
   AND m.ano_letivo IS NOT NULL
  WHERE fsp.escola_id = p_escola_id
    AND fsp.aluno_id = p_aluno_id
  GROUP BY m.ano_letivo
),
presenca_fallback AS (
  SELECT
    m.ano_letivo,
    COUNT(*) FILTER (WHERE COALESCE(f.status, '') IN ('falta', 'ausente'))::int AS faltas,
    COUNT(*) FILTER (WHERE COALESCE(f.status, '') IN ('presente', 'presenca'))::int AS presencas,
    COUNT(*)::int AS aulas_previstas
  FROM public.frequencias f
  INNER JOIN public.matriculas m
    ON m.id = f.matricula_id
   AND m.escola_id = p_escola_id
   AND m.aluno_id = p_aluno_id
   AND m.ano_letivo IS NOT NULL
  WHERE f.escola_id = p_escola_id
  GROUP BY m.ano_letivo
),
financeiro_mensalidades AS (
  SELECT
    COALESCE(m.ano_referencia, mb.ano_letivo) AS ano_letivo,
    SUM(COALESCE(m.valor_previsto, m.valor, 0)) AS total_previsto,
    SUM(COALESCE(m.valor_pago_total, 0)) AS total_pago_mensalidades,
    SUM(
      CASE
        WHEN COALESCE(m.status, '') <> 'pago'
         AND m.data_vencimento < CURRENT_DATE
        THEN GREATEST(COALESCE(m.valor_previsto, m.valor, 0) - COALESCE(m.valor_pago_total, 0), 0)
        ELSE 0
      END
    ) AS total_em_atraso,
    COUNT(*) FILTER (
      WHERE COALESCE(m.status, '') <> 'pago'
        AND m.data_vencimento < CURRENT_DATE
    )::int AS mensalidades_em_atraso
  FROM public.mensalidades m
  LEFT JOIN matriculas_base mb
    ON mb.id = m.matricula_id
  WHERE m.escola_id = p_escola_id
    AND m.aluno_id = p_aluno_id
  GROUP BY COALESCE(m.ano_referencia, mb.ano_letivo)
),
financeiro_pagamentos AS (
  SELECT
    COALESCE(m.ano_referencia, mb.ano_letivo, EXTRACT(YEAR FROM p.data_pagamento)::int) AS ano_letivo,
    SUM(
      CASE
        WHEN COALESCE(p.status, '') IN ('pago', 'confirmado', 'concluido', 'aprovado')
        THEN COALESCE(p.valor_pago, 0)
        ELSE 0
      END
    ) AS total_pago_pagamentos,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'pagamento_id', p.id,
          'data_pagamento', p.data_pagamento,
          'valor_pago', p.valor_pago,
          'metodo', COALESCE(p.metodo_pagamento, p.metodo),
          'status', p.status
        )
        ORDER BY p.data_pagamento DESC NULLS LAST, p.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::jsonb
    ) AS pagamentos_ordenados
  FROM public.pagamentos p
  LEFT JOIN public.mensalidades m
    ON m.id = p.mensalidade_id
   AND m.escola_id = p_escola_id
  LEFT JOIN matriculas_base mb
    ON mb.id = m.matricula_id
  WHERE p.escola_id = p_escola_id
    AND (
      p.aluno_id = p_aluno_id
      OR m.aluno_id = p_aluno_id
    )
  GROUP BY COALESCE(m.ano_referencia, mb.ano_letivo, EXTRACT(YEAR FROM p.data_pagamento)::int)
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'ano_letivo', ae.ano_letivo,
      'ano_letivo_id', ae.ano_letivo_id,
      'matricula', jsonb_build_object(
        'matricula_id', ae.matricula_id,
        'numero_matricula', ae.numero_matricula,
        'status', ae.status_matricula,
        'data_matricula', ae.data_matricula
      ),
      'academico', jsonb_build_object(
        'media_geral', ac.media_geral,
        'estado_final', ac.estado_final,
        'disciplinas_chave', COALESCE(ac.disciplinas_chave, '[]'::jsonb)
      ),
      'presenca', jsonb_build_object(
        'fonte', CASE WHEN ps.ano_letivo IS NOT NULL THEN 'snapshot_frequencia_status_periodo' ELSE 'fallback_frequencias' END,
        'faltas', COALESCE(ps.faltas, pf.faltas, 0),
        'presencas', COALESCE(ps.presencas, pf.presencas, 0),
        'aulas_previstas', COALESCE(ps.aulas_previstas, pf.aulas_previstas, 0),
        'frequencia_min_percent', COALESCE(ps.frequencia_min_percent, 75),
        'percentual_presenca',
          CASE
            WHEN COALESCE(ps.aulas_previstas, pf.aulas_previstas, 0) > 0 THEN
              ROUND((COALESCE(ps.presencas, pf.presencas, 0)::numeric / COALESCE(ps.aulas_previstas, pf.aulas_previstas, 0)::numeric) * 100, 2)
            ELSE NULL
          END
      ),
      'financeiro', jsonb_build_object(
        'total_previsto', COALESCE(fm.total_previsto, 0),
        'total_pago', GREATEST(COALESCE(fm.total_pago_mensalidades, 0), COALESCE(fp.total_pago_pagamentos, 0)),
        'total_em_atraso', COALESCE(fm.total_em_atraso, 0),
        'mensalidades_em_atraso', COALESCE(fm.mensalidades_em_atraso, 0),
        'ultimos_pagamentos', COALESCE((
          SELECT jsonb_agg(up.item ORDER BY up.pos)
          FROM (
            SELECT value AS item, ordinality AS pos
            FROM jsonb_array_elements(COALESCE(fp.pagamentos_ordenados, '[]'::jsonb)) WITH ORDINALITY
            ORDER BY ordinality
            LIMIT 3
          ) up
        ), '[]'::jsonb)
      )
    )
    ORDER BY ae.ano_letivo ASC
  ),
  '[]'::jsonb
)
FROM anos_enriquecidos ae
LEFT JOIN academico ac
  ON ac.ano_letivo = ae.ano_letivo
LEFT JOIN presenca_snapshot ps
  ON ps.ano_letivo = ae.ano_letivo
LEFT JOIN presenca_fallback pf
  ON pf.ano_letivo = ae.ano_letivo
LEFT JOIN financeiro_mensalidades fm
  ON fm.ano_letivo = ae.ano_letivo
LEFT JOIN financeiro_pagamentos fp
  ON fp.ano_letivo = ae.ano_letivo;
$$;
