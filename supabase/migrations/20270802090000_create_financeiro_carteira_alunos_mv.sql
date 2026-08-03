BEGIN;

CREATE SCHEMA IF NOT EXISTS internal;

CREATE MATERIALIZED VIEW internal.mv_financeiro_carteira_alunos AS
WITH matriculas_ativas AS (
  SELECT
    m.id AS matricula_id,
    m.escola_id,
    m.aluno_id,
    m.turma_id,
    m.ano_letivo,
    m.numero_matricula,
    ROW_NUMBER() OVER (
      PARTITION BY m.escola_id, m.aluno_id
      ORDER BY m.ano_letivo DESC NULLS LAST, m.updated_at DESC NULLS LAST, m.id DESC
    ) AS ordem
  FROM public.matriculas AS m
  WHERE LOWER(COALESCE(m.status, '')) IN ('ativo', 'ativa', 'active')
     OR m.ativo IS TRUE
), mensalidades_normalizadas AS (
  SELECT
    mensalidade.escola_id,
    mensalidade.aluno_id,
    CASE
      WHEN mensalidade.ano_letivo ~ '^[0-9]{4}$'
        THEN mensalidade.ano_letivo::integer
      ELSE NULL
    END AS ano_letivo,
    LOWER(COALESCE(mensalidade.status, 'pendente')) AS status,
    COALESCE(mensalidade.valor_previsto, mensalidade.valor, 0)::numeric AS valor_previsto,
    COALESCE(mensalidade.valor_pago_total, 0)::numeric AS valor_pago,
    mensalidade.data_vencimento
  FROM public.mensalidades AS mensalidade
  WHERE LOWER(COALESCE(mensalidade.status, '')) NOT IN ('cancelado', 'cancelada')
), carteira_agregada AS (
  SELECT
    mensalidade.escola_id,
    mensalidade.aluno_id,
    mensalidade.ano_letivo,
    COUNT(*)::bigint AS qtd_mensalidades,
    COUNT(*) FILTER (
      WHERE mensalidade.status IN ('pago', 'paga')
    )::bigint AS qtd_mensalidades_pagas,
    COUNT(*) FILTER (
      WHERE mensalidade.status IN ('pendente', 'pago_parcial')
    )::bigint AS qtd_mensalidades_pendentes,
    COUNT(*) FILTER (
      WHERE mensalidade.status IN ('pendente', 'pago_parcial')
        AND mensalidade.data_vencimento < CURRENT_DATE
        AND GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0) > 0
    )::bigint AS qtd_mensalidades_atrasadas,
    SUM(mensalidade.valor_previsto)::numeric AS valor_previsto_total,
    SUM(mensalidade.valor_pago)::numeric AS valor_pago_total,
    SUM(
      CASE
        WHEN mensalidade.status IN ('pendente', 'pago_parcial')
          THEN GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0)
        ELSE 0
      END
    )::numeric AS valor_em_aberto,
    SUM(
      CASE
        WHEN mensalidade.status IN ('pendente', 'pago_parcial')
          AND mensalidade.data_vencimento < CURRENT_DATE
          THEN GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0)
        ELSE 0
      END
    )::numeric AS valor_em_atraso,
    MIN(mensalidade.data_vencimento) FILTER (
      WHERE mensalidade.status IN ('pendente', 'pago_parcial')
        AND GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0) > 0
    ) AS proximo_vencimento,
    MIN(mensalidade.data_vencimento) FILTER (
      WHERE mensalidade.status IN ('pendente', 'pago_parcial')
        AND mensalidade.data_vencimento < CURRENT_DATE
        AND GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0) > 0
    ) AS vencimento_mais_antigo,
    MAX(
      CASE
        WHEN mensalidade.status IN ('pendente', 'pago_parcial')
          AND mensalidade.data_vencimento < CURRENT_DATE
          AND GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0) > 0
          THEN GREATEST(CURRENT_DATE - mensalidade.data_vencimento, 0)
        ELSE 0
      END
    )::integer AS dias_maximo_atraso
  FROM mensalidades_normalizadas AS mensalidade
  GROUP BY mensalidade.escola_id, mensalidade.aluno_id, mensalidade.ano_letivo
)
SELECT
  matricula.escola_id,
  matricula.matricula_id,
  matricula.aluno_id,
  matricula.numero_matricula,
  COALESCE(NULLIF(aluno.nome_completo, ''), NULLIF(aluno.nome, ''), 'Aluno')::text AS nome_aluno,
  aluno.responsavel,
  aluno.telefone_responsavel AS telefone,
  matricula.turma_id,
  turma.nome AS nome_turma,
  turma.classe_id,
  classe.nome AS nome_classe,
  COALESCE(turma.curso_id, classe.curso_id) AS curso_id,
  curso.nome AS nome_curso,
  matricula.ano_letivo,
  COALESCE(carteira.qtd_mensalidades, 0)::bigint AS qtd_mensalidades,
  COALESCE(carteira.qtd_mensalidades_pagas, 0)::bigint AS qtd_mensalidades_pagas,
  COALESCE(carteira.qtd_mensalidades_pendentes, 0)::bigint AS qtd_mensalidades_pendentes,
  COALESCE(carteira.qtd_mensalidades_atrasadas, 0)::bigint AS qtd_mensalidades_atrasadas,
  COALESCE(carteira.valor_previsto_total, 0)::numeric AS valor_previsto_total,
  COALESCE(carteira.valor_pago_total, 0)::numeric AS valor_pago_total,
  COALESCE(carteira.valor_em_aberto, 0)::numeric AS valor_em_aberto,
  COALESCE(carteira.valor_em_atraso, 0)::numeric AS valor_em_atraso,
  carteira.proximo_vencimento,
  carteira.vencimento_mais_antigo,
  COALESCE(carteira.dias_maximo_atraso, 0)::integer AS dias_maximo_atraso,
  CASE
    WHEN COALESCE(carteira.qtd_mensalidades, 0) = 0 THEN 'sem_lancamentos'
    WHEN COALESCE(carteira.valor_em_atraso, 0) > 0 THEN 'atrasado'
    WHEN COALESCE(carteira.valor_em_aberto, 0) > 0 THEN 'pendente'
    ELSE 'regular'
  END::text AS status_financeiro,
  CASE
    WHEN COALESCE(carteira.dias_maximo_atraso, 0) >= 30 THEN 'critico'
    WHEN COALESCE(carteira.dias_maximo_atraso, 0) >= 10 THEN 'atencao'
    WHEN COALESCE(carteira.dias_maximo_atraso, 0) > 0 THEN 'recente'
    ELSE 'sem_risco'
  END::text AS status_risco
FROM matriculas_ativas AS matricula
JOIN public.alunos AS aluno
  ON aluno.id = matricula.aluno_id
 AND aluno.escola_id = matricula.escola_id
LEFT JOIN public.turmas AS turma
  ON turma.id = matricula.turma_id
 AND turma.escola_id = matricula.escola_id
LEFT JOIN public.classes AS classe
  ON classe.id = turma.classe_id
 AND classe.escola_id = matricula.escola_id
LEFT JOIN public.cursos AS curso
  ON curso.id = COALESCE(turma.curso_id, classe.curso_id)
 AND curso.escola_id = matricula.escola_id
LEFT JOIN carteira_agregada AS carteira
  ON carteira.escola_id = matricula.escola_id
 AND carteira.aluno_id = matricula.aluno_id
 AND carteira.ano_letivo = matricula.ano_letivo
WHERE matricula.ordem = 1;

ALTER MATERIALIZED VIEW internal.mv_financeiro_carteira_alunos OWNER TO postgres;

CREATE UNIQUE INDEX ux_mv_financeiro_carteira_alunos
  ON internal.mv_financeiro_carteira_alunos (escola_id, aluno_id);

CREATE INDEX ix_mv_financeiro_carteira_status
  ON internal.mv_financeiro_carteira_alunos (
    escola_id,
    status_financeiro,
    status_risco,
    turma_id
  );

REVOKE ALL ON internal.mv_financeiro_carteira_alunos
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_carteira_alunos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_carteira_alunos;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_mv_financeiro_carteira_alunos()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_mv_financeiro_carteira_alunos()
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_financeiro_carteira_alunos_for_current_user()
RETURNS TABLE (
  escola_id uuid,
  matricula_id uuid,
  aluno_id uuid,
  numero_matricula text,
  nome_aluno text,
  responsavel text,
  telefone text,
  turma_id uuid,
  nome_turma text,
  classe_id uuid,
  nome_classe text,
  curso_id uuid,
  nome_curso text,
  ano_letivo integer,
  qtd_mensalidades bigint,
  qtd_mensalidades_pagas bigint,
  qtd_mensalidades_pendentes bigint,
  qtd_mensalidades_atrasadas bigint,
  valor_previsto_total numeric,
  valor_pago_total numeric,
  valor_em_aberto numeric,
  valor_em_atraso numeric,
  proximo_vencimento date,
  vencimento_mais_antigo date,
  dias_maximo_atraso integer,
  status_financeiro text,
  status_risco text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    carteira.escola_id,
    carteira.matricula_id,
    carteira.aluno_id,
    carteira.numero_matricula,
    carteira.nome_aluno,
    carteira.responsavel,
    carteira.telefone,
    carteira.turma_id,
    carteira.nome_turma,
    carteira.classe_id,
    carteira.nome_classe,
    carteira.curso_id,
    carteira.nome_curso,
    carteira.ano_letivo,
    carteira.qtd_mensalidades,
    carteira.qtd_mensalidades_pagas,
    carteira.qtd_mensalidades_pendentes,
    carteira.qtd_mensalidades_atrasadas,
    carteira.valor_previsto_total,
    carteira.valor_pago_total,
    carteira.valor_em_aberto,
    carteira.valor_em_atraso,
    carteira.proximo_vencimento,
    carteira.vencimento_mais_antigo,
    carteira.dias_maximo_atraso,
    carteira.status_financeiro,
    carteira.status_risco
  FROM internal.mv_financeiro_carteira_alunos AS carteira
  WHERE auth.role() = 'service_role'
     OR EXISTS (
       SELECT 1
       FROM public.escola_users AS escola_user
       WHERE escola_user.escola_id = carteira.escola_id
         AND escola_user.user_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.get_financeiro_carteira_alunos_for_current_user()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_financeiro_carteira_alunos_for_current_user()
  TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_financeiro_carteira_alunos
WITH (security_invoker = true) AS
SELECT *
FROM public.get_financeiro_carteira_alunos_for_current_user();

ALTER VIEW public.vw_financeiro_carteira_alunos OWNER TO postgres;

REVOKE ALL ON public.vw_financeiro_carteira_alunos
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.vw_financeiro_carteira_alunos
  TO authenticated, service_role;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'refresh-mv-financeiro-carteira-alunos'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'refresh-mv-financeiro-carteira-alunos',
  '*/5 * * * *',
  'SELECT public.refresh_mv_financeiro_carteira_alunos();'
);

COMMIT;
