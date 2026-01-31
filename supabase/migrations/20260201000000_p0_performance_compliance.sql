BEGIN;

-- =========================================================
-- 1) MVs PÚBLICAS SEM UNIQUE INDEX (REFRESH CONCURRENTLY)
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_escola_dia
  ON public.mv_financeiro_escola_dia (dia);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_freq_por_turma_dia
  ON public.mv_freq_por_turma_dia (escola_id, turma_id, dia);

-- =========================================================
-- 2) FINANCEIRO DASHBOARD (mv_* + vw_*)
-- =========================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_dashboard AS
SELECT
  escola_id,
  data_referencia,
  total_pendente,
  total_pago,
  total_inadimplente,
  alunos_inadimplentes,
  alunos_em_dia,
  sync_status,
  sync_updated_at
FROM public.aggregates_financeiro
WHERE aluno_id IS NULL
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_dashboard
  ON internal.mv_financeiro_dashboard (escola_id, data_referencia);

CREATE OR REPLACE VIEW public.vw_financeiro_dashboard AS
SELECT
  escola_id,
  data_referencia,
  total_pendente,
  total_pago,
  total_inadimplente,
  alunos_inadimplentes,
  alunos_em_dia,
  sync_status,
  sync_updated_at
FROM internal.mv_financeiro_dashboard
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
)
  AND data_referencia = date_trunc('month', now())::date;

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_dashboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_dashboard',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard$$
);

GRANT ALL ON TABLE internal.mv_financeiro_dashboard TO anon, authenticated, service_role;

-- =========================================================
-- 3) FINANCEIRO PROPINAS (mv_* + vw_*)
-- =========================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS internal.mv_financeiro_propinas_mensal_escola AS
SELECT
  m.escola_id,
  m.ano_letivo,
  date_trunc('month', m.data_vencimento)::date AS competencia_mes,
  EXTRACT(YEAR  FROM m.data_vencimento)::int   AS ano,
  EXTRACT(MONTH FROM m.data_vencimento)::int   AS mes,
  COUNT(*)::int AS qtd_mensalidades,
  COUNT(*) FILTER (
    WHERE m.data_vencimento < CURRENT_DATE
      AND m.status IN ('pendente','pago_parcial')
  )::int AS qtd_em_atraso,
  SUM(COALESCE(m.valor_previsto, 0))::numeric(14,2) AS total_previsto,
  SUM(COALESCE(m.valor_pago_total, 0))::numeric(14,2) AS total_pago,
  SUM(
    CASE
      WHEN m.data_vencimento < CURRENT_DATE
       AND m.status IN ('pendente','pago_parcial')
      THEN GREATEST(0, COALESCE(m.valor_previsto,0) - COALESCE(m.valor_pago_total,0))
      ELSE 0
    END
  )::numeric(14,2) AS total_em_atraso,
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(
        COUNT(*) FILTER (
          WHERE m.data_vencimento < CURRENT_DATE
            AND m.status IN ('pendente','pago_parcial')
        )::numeric
        / COUNT(*)::numeric * 100,
        2
      )
    ELSE 0
  END AS inadimplencia_pct
FROM public.mensalidades m
GROUP BY
  m.escola_id,
  m.ano_letivo,
  date_trunc('month', m.data_vencimento),
  EXTRACT(YEAR  FROM m.data_vencimento),
  EXTRACT(MONTH FROM m.data_vencimento)
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_financeiro_propinas_mensal_escola
  ON internal.mv_financeiro_propinas_mensal_escola (escola_id, ano_letivo, ano, mes);

CREATE OR REPLACE VIEW public.vw_financeiro_propinas_mensal_escola AS
SELECT
  escola_id,
  ano_letivo,
  ano,
  mes,
  competencia_mes,
  qtd_mensalidades,
  qtd_em_atraso,
  total_previsto,
  total_pago,
  total_em_atraso,
  inadimplencia_pct
FROM internal.mv_financeiro_propinas_mensal_escola
WHERE escola_id IN (
  SELECT eu.escola_id
  FROM public.escola_users eu
  WHERE eu.user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.refresh_mv_financeiro_propinas_mensal_escola()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_mensal_escola;
END;
$$;

SELECT cron.schedule(
  'refresh_mv_financeiro_propinas_mensal_escola',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_propinas_mensal_escola$$
);

GRANT ALL ON TABLE internal.mv_financeiro_propinas_mensal_escola TO anon, authenticated, service_role;

-- =========================================================
-- 4) RLS EM TABELAS PÚBLICAS SEM POLICY
-- =========================================================

ALTER TABLE public.aluno_processo_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.aluno_processo_counters;
CREATE POLICY tenant_select ON public.aluno_processo_counters
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.aluno_processo_counters;
CREATE POLICY super_admin_select ON public.aluno_processo_counters
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.aulas;
CREATE POLICY tenant_select ON public.aulas
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.aulas;
CREATE POLICY super_admin_select ON public.aulas
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.financeiro_contratos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.financeiro_contratos;
CREATE POLICY tenant_select ON public.financeiro_contratos
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.financeiro_contratos;
CREATE POLICY super_admin_select ON public.financeiro_contratos
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.historico_anos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.historico_anos;
CREATE POLICY tenant_select ON public.historico_anos
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.historico_anos;
CREATE POLICY super_admin_select ON public.historico_anos
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.historico_disciplinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.historico_disciplinas;
CREATE POLICY tenant_select ON public.historico_disciplinas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.historico_anos ha
      WHERE ha.id = historico_ano_id
        AND ha.escola_id = public.current_tenant_escola_id()
    )
  );
DROP POLICY IF EXISTS super_admin_select ON public.historico_disciplinas;
CREATE POLICY super_admin_select ON public.historico_disciplinas
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.matricula_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.matricula_counters;
CREATE POLICY tenant_select ON public.matricula_counters
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.matricula_counters;
CREATE POLICY super_admin_select ON public.matricula_counters
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.notas_avaliacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.notas_avaliacoes;
CREATE POLICY tenant_select ON public.notas_avaliacoes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.avaliacoes a
      WHERE a.id = avaliacao_id
        AND a.escola_id = public.current_tenant_escola_id()
    )
  );
DROP POLICY IF EXISTS super_admin_select ON public.notas_avaliacoes;
CREATE POLICY super_admin_select ON public.notas_avaliacoes
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.outbox_notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.outbox_notificacoes;
CREATE POLICY tenant_select ON public.outbox_notificacoes
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.outbox_notificacoes;
CREATE POLICY super_admin_select ON public.outbox_notificacoes
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

ALTER TABLE public.profiles_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.profiles_archive;
CREATE POLICY tenant_select ON public.profiles_archive
  FOR SELECT TO authenticated
  USING (escola_id = public.current_tenant_escola_id());
DROP POLICY IF EXISTS super_admin_select ON public.profiles_archive;
CREATE POLICY super_admin_select ON public.profiles_archive
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

COMMIT;
