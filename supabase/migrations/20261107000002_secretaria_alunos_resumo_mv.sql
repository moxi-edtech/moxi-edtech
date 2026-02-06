BEGIN;

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_secretaria_alunos_resumo AS
WITH matricula_ativa AS (
  SELECT DISTINCT ON (m.escola_id, m.aluno_id)
    m.escola_id,
    m.aluno_id,
    t.nome AS turma_nome,
    m.created_at
  FROM public.matriculas m
  LEFT JOIN public.turmas t ON t.id = m.turma_id
  WHERE m.status IN ('ativa', 'ativo', 'active')
  ORDER BY m.escola_id, m.aluno_id, m.created_at DESC
),
mensalidades_atraso AS (
  SELECT
    m.escola_id,
    m.aluno_id,
    SUM(
      GREATEST(
        0,
        COALESCE(m.valor_previsto, 0) - COALESCE(m.valor_pago_total, 0)
      )
    )::numeric(14,2) AS total_em_atraso
  FROM public.mensalidades m
  WHERE m.status IN ('pendente', 'pago_parcial')
    AND m.data_vencimento < CURRENT_DATE
  GROUP BY m.escola_id, m.aluno_id
)
SELECT
  a.escola_id,
  a.id AS aluno_id,
  ma.turma_nome,
  COALESCE(ma2.total_em_atraso, 0)::numeric(14,2) AS total_em_atraso
FROM public.alunos a
LEFT JOIN matricula_ativa ma
  ON ma.escola_id = a.escola_id
  AND ma.aluno_id = a.id
LEFT JOIN mensalidades_atraso ma2
  ON ma2.escola_id = a.escola_id
  AND ma2.aluno_id = a.id
WHERE a.deleted_at IS NULL
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_secretaria_alunos_resumo
  ON internal.mv_secretaria_alunos_resumo (escola_id, aluno_id);

CREATE OR REPLACE VIEW public.vw_secretaria_alunos_resumo
WITH (security_invoker = true) AS
SELECT
  escola_id,
  aluno_id,
  turma_nome,
  total_em_atraso
FROM internal.mv_secretaria_alunos_resumo
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_secretaria_alunos_resumo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_alunos_resumo;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_secretaria_alunos_resumo',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_secretaria_alunos_resumo$$
);

GRANT ALL ON TABLE internal.mv_secretaria_alunos_resumo TO anon, authenticated, service_role;

COMMIT;
