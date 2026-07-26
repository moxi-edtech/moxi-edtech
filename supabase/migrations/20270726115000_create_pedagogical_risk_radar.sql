BEGIN;

CREATE MATERIALIZED VIEW internal.mv_risco_pedagogico_aluno AS
WITH active_enrollments AS (
  SELECT
    m.escola_id,
    m.id AS matricula_id,
    m.aluno_id,
    m.turma_id
  FROM public.matriculas AS m
  WHERE m.ativo = true
    AND m.status = ANY (ARRAY['ativo', 'ativa', 'active'])
),
attendance_ranked AS (
  SELECT
    f.escola_id,
    f.matricula_id,
    f.data,
    f.status,
    row_number() OVER (
      PARTITION BY f.escola_id, f.matricula_id
      ORDER BY f.data DESC, f.id DESC
    ) AS recent_order
  FROM public.frequencias AS f
  JOIN active_enrollments AS ae
    ON ae.escola_id = f.escola_id
   AND ae.matricula_id = f.matricula_id
  WHERE f.data >= current_date - 30
),
attendance AS (
  SELECT
    ar.escola_id,
    ar.matricula_id,
    count(*) AS attendance_records_30d,
    count(*) FILTER (WHERE ar.status = 'presente') AS present_records_30d,
    count(*) FILTER (WHERE ar.status = 'falta') AS absence_records_30d,
    coalesce(
      min(ar.recent_order) FILTER (WHERE ar.status <> 'falta') - 1,
      count(*)
    )::integer AS consecutive_absences,
    round(
      100.0 * count(*) FILTER (WHERE ar.status = 'presente')
      / nullif(count(*), 0),
      2
    ) AS attendance_rate_30d
  FROM attendance_ranked AS ar
  GROUP BY ar.escola_id, ar.matricula_id
),
grades_by_term AS (
  SELECT
    n.escola_id,
    n.matricula_id,
    a.trimestre,
    round(avg(100.0 * n.valor / nullif(a.nota_max, 0)), 2) AS grade_rate
  FROM public.notas AS n
  JOIN public.avaliacoes AS a
    ON a.escola_id = n.escola_id
   AND a.id = n.avaliacao_id
  JOIN active_enrollments AS ae
    ON ae.escola_id = n.escola_id
   AND ae.matricula_id = n.matricula_id
  WHERE coalesce(n.is_isento, false) = false
    AND a.trimestre IS NOT NULL
    AND a.nota_max > 0
  GROUP BY n.escola_id, n.matricula_id, a.trimestre
),
grades_ranked AS (
  SELECT
    g.*,
    row_number() OVER (
      PARTITION BY g.escola_id, g.matricula_id
      ORDER BY g.trimestre DESC
    ) AS term_order,
    count(*) OVER (
      PARTITION BY g.escola_id, g.matricula_id
    ) AS terms_with_grades
  FROM grades_by_term AS g
),
grades AS (
  SELECT
    gr.escola_id,
    gr.matricula_id,
    max(gr.terms_with_grades) AS terms_with_grades,
    max(gr.grade_rate) FILTER (WHERE gr.term_order = 1) AS current_grade_rate,
    max(gr.grade_rate) FILTER (WHERE gr.term_order = 2) AS previous_grade_rate
  FROM grades_ranked AS gr
  GROUP BY gr.escola_id, gr.matricula_id
),
signals AS (
  SELECT
    ae.escola_id,
    ae.matricula_id,
    ae.aluno_id,
    ae.turma_id,
    coalesce(att.attendance_records_30d, 0)::integer AS attendance_records_30d,
    coalesce(att.absence_records_30d, 0)::integer AS absence_records_30d,
    coalesce(att.consecutive_absences, 0)::integer AS consecutive_absences,
    att.attendance_rate_30d,
    coalesce(g.terms_with_grades, 0)::integer AS terms_with_grades,
    g.current_grade_rate,
    g.previous_grade_rate,
    CASE
      WHEN g.current_grade_rate IS NOT NULL
       AND g.previous_grade_rate IS NOT NULL
      THEN round(g.previous_grade_rate - g.current_grade_rate, 2)
      ELSE NULL
    END AS grade_drop_points,
    (
      CASE WHEN coalesce(att.consecutive_absences, 0) >= 3 THEN 25 ELSE 0 END
      + CASE
          WHEN coalesce(att.attendance_records_30d, 0) >= 5
           AND att.attendance_rate_30d < 75
          THEN 40 ELSE 0
        END
      + CASE
          WHEN g.current_grade_rate IS NOT NULL
           AND g.previous_grade_rate IS NOT NULL
           AND g.previous_grade_rate - g.current_grade_rate >= 15
          THEN 35 ELSE 0
        END
      + CASE
          WHEN g.current_grade_rate IS NOT NULL
           AND g.current_grade_rate < 50
          THEN 20 ELSE 0
        END
    )::integer AS risk_score
  FROM active_enrollments AS ae
  LEFT JOIN attendance AS att
    ON att.escola_id = ae.escola_id
   AND att.matricula_id = ae.matricula_id
  LEFT JOIN grades AS g
    ON g.escola_id = ae.escola_id
   AND g.matricula_id = ae.matricula_id
)
SELECT
  s.*,
  CASE
    WHEN s.attendance_records_30d >= 5 AND s.terms_with_grades >= 2
      THEN 'complete'
    WHEN s.attendance_records_30d >= 5 OR s.terms_with_grades >= 1
      THEN 'partial'
    ELSE 'insufficient'
  END AS data_coverage,
  CASE
    WHEN s.risk_score >= 60 THEN 'high'
    WHEN s.risk_score >= 30 THEN 'medium'
    ELSE 'low'
  END AS risk_level,
  array_remove(ARRAY[
    CASE WHEN s.consecutive_absences >= 3 THEN 'three_consecutive_absences' END,
    CASE
      WHEN s.attendance_records_30d >= 5
       AND s.attendance_rate_30d < 75
      THEN 'attendance_below_75'
    END,
    CASE WHEN s.grade_drop_points >= 15 THEN 'grade_drop_15_points' END,
    CASE WHEN s.current_grade_rate < 50 THEN 'current_grade_below_50' END
  ], NULL)::text[] AS risk_reasons,
  now() AS calculated_at
FROM signals AS s;

CREATE UNIQUE INDEX ux_mv_risco_pedagogico_aluno
  ON internal.mv_risco_pedagogico_aluno (escola_id, matricula_id);

REVOKE ALL ON internal.mv_risco_pedagogico_aluno
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON internal.mv_risco_pedagogico_aluno
  TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_mv_risco_pedagogico_aluno()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_risco_pedagogico_aluno;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_mv_risco_pedagogico_aluno()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_risco_pedagogico_aluno()
  TO service_role;

CREATE OR REPLACE FUNCTION internal.get_risco_pedagogico_for_current_user()
RETURNS SETOF internal.mv_risco_pedagogico_aluno
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT risk
  FROM internal.mv_risco_pedagogico_aluno AS risk
  WHERE auth.role() = 'service_role'
     OR EXISTS (
       SELECT 1
       FROM public.escola_users AS eu
       WHERE eu.escola_id = risk.escola_id
         AND eu.user_id = auth.uid()
         AND eu.tenant_type = 'k12'
         AND lower(trim(coalesce(eu.papel, ''))) = ANY (
           ARRAY[
             'admin',
             'admin_escola',
             'staff_admin',
             'secretaria'
           ]::text[]
         )
     );
$$;

REVOKE ALL ON FUNCTION internal.get_risco_pedagogico_for_current_user()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION internal.get_risco_pedagogico_for_current_user()
  TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_risco_pedagogico_aluno
WITH (security_invoker = true) AS
SELECT *
FROM internal.get_risco_pedagogico_for_current_user();

ALTER VIEW public.vw_risco_pedagogico_aluno OWNER TO postgres;
REVOKE ALL ON public.vw_risco_pedagogico_aluno
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vw_risco_pedagogico_aluno
  TO authenticated, service_role;

SELECT cron.schedule(
  'refresh-mv-risco-pedagogico-aluno',
  '*/15 * * * *',
  $command$SELECT public.refresh_mv_risco_pedagogico_aluno();$command$
);

COMMIT;
