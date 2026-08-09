BEGIN;

-- Relatório vivo de integridade. Não corrige nem apaga dados: apenas identifica
-- mensalidades que precisam de revisão financeira/académica.
CREATE OR REPLACE VIEW public.vw_financeiro_mensalidades_reconciliacao
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    me.id AS mensalidade_id,
    me.escola_id,
    me.aluno_id,
    COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno sem nome') AS aluno_nome,
    me.matricula_id,
    m.session_id,
    m.ano_letivo AS matricula_ano_letivo,
    me.ano_letivo AS mensalidade_ano_letivo,
    me.turma_id AS mensalidade_turma_id,
    m.turma_id AS matricula_turma_id,
    COALESCE(mt.nome, mm.nome) AS turma_nome,
    me.data_vencimento,
    me.mes_referencia,
    me.ano_referencia,
    me.status,
    COALESCE(me.valor_previsto, me.valor, 0)::numeric AS valor_previsto,
    COALESCE(me.valor_pago_total, 0)::numeric AS valor_pago_total,
    GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0)::numeric AS saldo,
    al.id AS ano_letivo_id,
    al.ano AS ano_letivo,
    al.data_inicio AS calendario_inicio,
    al.data_fim AS calendario_fim,
    m.id AS matricula_encontrada_id,
    m.escola_id AS matricula_escola_id,
    m.aluno_id AS matricula_aluno_id
  FROM public.mensalidades me
  LEFT JOIN public.alunos a
    ON a.id = me.aluno_id
   AND a.escola_id = me.escola_id
  LEFT JOIN public.matriculas m
    ON m.id = me.matricula_id
   AND m.escola_id = me.escola_id
  LEFT JOIN public.turmas mt
    ON mt.id = me.turma_id
   AND mt.escola_id = me.escola_id
  LEFT JOIN public.turmas mm
    ON mm.id = m.turma_id
   AND mm.escola_id = me.escola_id
  LEFT JOIN public.anos_letivos al
    ON al.id = m.session_id
   AND al.escola_id = me.escola_id
  WHERE me.escola_id = public.current_tenant_escola_id()
), annotated AS (
  SELECT
    base.*,
    ARRAY_REMOVE(ARRAY[
      CASE
        WHEN base.matricula_id IS NULL
          OR base.matricula_encontrada_id IS NULL
          OR base.matricula_escola_id IS DISTINCT FROM base.escola_id
          OR base.matricula_aluno_id IS DISTINCT FROM base.aluno_id
        THEN 'SEM_MATRICULA'::text
      END,
      CASE
        WHEN base.matricula_encontrada_id IS NOT NULL
         AND base.mensalidade_ano_letivo ~ '^\\d{4}$'
         AND base.mensalidade_ano_letivo::integer IS DISTINCT FROM base.matricula_ano_letivo
        THEN 'ANO_DIVERGENTE'::text
      END,
      CASE
        WHEN base.matricula_encontrada_id IS NOT NULL
         AND base.mensalidade_turma_id IS NOT NULL
         AND base.matricula_turma_id IS NOT NULL
         AND base.mensalidade_turma_id IS DISTINCT FROM base.matricula_turma_id
        THEN 'TURMA_DIVERGENTE'::text
      END,
      CASE
        WHEN base.matricula_encontrada_id IS NOT NULL
         AND base.data_vencimento IS NULL
        THEN 'SEM_DATA_VENCIMENTO'::text
      END,
      CASE
        WHEN base.matricula_encontrada_id IS NOT NULL
         AND base.ano_letivo_id IS NULL
        THEN 'SEM_CALENDARIO'::text
      END,
      CASE
        WHEN base.matricula_encontrada_id IS NOT NULL
         AND base.data_vencimento IS NOT NULL
         AND base.ano_letivo_id IS NOT NULL
         AND (
           base.data_vencimento < base.calendario_inicio
           OR base.data_vencimento > base.calendario_fim
         )
        THEN 'FORA_CALENDARIO'::text
      END
    ], NULL::text) AS problemas
  FROM base
)
SELECT
  mensalidade_id,
  escola_id,
  aluno_id,
  aluno_nome,
  matricula_id,
  session_id,
  ano_letivo_id,
  ano_letivo,
  matricula_ano_letivo,
  mensalidade_ano_letivo,
  mensalidade_turma_id,
  matricula_turma_id,
  turma_nome,
  data_vencimento,
  mes_referencia,
  ano_referencia,
  status,
  valor_previsto,
  valor_pago_total,
  saldo,
  problemas,
  problemas[1] AS problema_principal,
  calendario_inicio,
  calendario_fim
FROM annotated
WHERE cardinality(problemas) > 0;

CREATE OR REPLACE FUNCTION public.get_financeiro_mensalidades_reconciliacao_resumo(
  p_escola_id uuid,
  p_ano_letivo_id uuid DEFAULT NULL
)
RETURNS TABLE(problema text, total bigint, saldo numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.current_tenant_escola_id() IS DISTINCT FROM p_escola_id THEN
    RAISE EXCEPTION 'AUTH: escola_id inválido';
  END IF;
  IF NOT public.user_has_role_in_school(
    p_escola_id,
    ARRAY['admin','admin_escola','staff_admin','admin_secretaria','admin_financeiro','diretor','secretaria_financeiro','secretaria']
  ) THEN
    RAISE EXCEPTION 'AUTH: permissão negada';
  END IF;

  RETURN QUERY
  SELECT issue.problema,
         COUNT(*)::bigint,
         COALESCE(SUM(v.saldo), 0)::numeric
  FROM public.vw_financeiro_mensalidades_reconciliacao v
  CROSS JOIN LATERAL unnest(v.problemas) AS issue(problema)
  WHERE v.escola_id = p_escola_id
    AND (p_ano_letivo_id IS NULL OR v.ano_letivo_id = p_ano_letivo_id)
  GROUP BY issue.problema
  ORDER BY issue.problema;
END;
$$;

REVOKE ALL ON FUNCTION public.get_financeiro_mensalidades_reconciliacao_resumo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_financeiro_mensalidades_reconciliacao_resumo(uuid, uuid) TO authenticated;
GRANT SELECT ON public.vw_financeiro_mensalidades_reconciliacao TO authenticated, service_role;

DROP VIEW IF EXISTS public.vw_financeiro_kpis_mes_ano;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_kpis_mes_ano;
CREATE MATERIALIZED VIEW internal.mv_financeiro_kpis_mes_ano AS
WITH base AS (
  SELECT
    me.id AS mensalidade_id,
    me.escola_id,
    me.data_vencimento,
    me.data_pagamento_efetiva,
    me.status,
    COALESCE(me.valor_previsto, me.valor, 0)::numeric AS previsto,
    COALESCE(me.valor_pago_total, 0)::numeric AS pago,
    m.session_id AS ano_letivo_id,
    al.ano AS ano_letivo
  FROM public.mensalidades me
  JOIN public.matriculas m
    ON m.id = me.matricula_id
   AND m.escola_id = me.escola_id
  JOIN public.anos_letivos al
    ON al.id = m.session_id
   AND al.escola_id = me.escola_id
), previsto AS (
  SELECT escola_id, ano_letivo_id, ano_letivo,
         date_trunc('month', data_vencimento)::date AS mes_ref,
         SUM(previsto)::numeric(14,2) AS previsto_total,
         SUM(pago)::numeric(14,2) AS pago_competencia_total,
         SUM(GREATEST(previsto - pago, 0)) FILTER (
           WHERE data_vencimento < CURRENT_DATE
             AND status IN ('pendente','atrasado','parcial','pago_parcial')
         )::numeric(14,2) AS inadimplencia_total
  FROM base
  WHERE status <> 'cancelado'
  GROUP BY escola_id, ano_letivo_id, ano_letivo, date_trunc('month', data_vencimento)::date
), realizado AS (
  SELECT b.escola_id, b.ano_letivo_id, b.ano_letivo,
         date_trunc('month', p.data_pagamento)::date AS mes_ref,
         SUM(COALESCE(p.valor_pago, 0))::numeric(14,2) AS realizado_total
  FROM base b
  JOIN public.pagamentos p ON p.mensalidade_id = b.mensalidade_id
  WHERE p.data_pagamento IS NOT NULL
    AND p.status IN ('pago','concluido','settled','liquidado')
  GROUP BY b.escola_id, b.ano_letivo_id, b.ano_letivo, date_trunc('month', p.data_pagamento)::date
), meses AS (
  SELECT escola_id, ano_letivo_id, ano_letivo, mes_ref FROM previsto
  UNION
  SELECT escola_id, ano_letivo_id, ano_letivo, mes_ref FROM realizado
)
SELECT
  meses.escola_id,
  meses.ano_letivo_id,
  meses.ano_letivo,
  meses.mes_ref,
  COALESCE(p.previsto_total, 0)::numeric(14,2) AS previsto_total,
  COALESCE(p.pago_competencia_total, 0)::numeric(14,2) AS pago_competencia_total,
  COALESCE(r.realizado_total, 0)::numeric(14,2) AS realizado_total,
  COALESCE(p.inadimplencia_total, 0)::numeric(14,2) AS inadimplencia_total
FROM meses
LEFT JOIN previsto p USING (escola_id, ano_letivo_id, ano_letivo, mes_ref)
LEFT JOIN realizado r USING (escola_id, ano_letivo_id, ano_letivo, mes_ref)
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_financeiro_kpis_mes_ano
  ON internal.mv_financeiro_kpis_mes_ano (escola_id, ano_letivo_id, mes_ref);

CREATE VIEW public.vw_financeiro_kpis_mes_ano WITH (security_invoker = true) AS
SELECT escola_id, ano_letivo_id, ano_letivo, mes_ref, previsto_total,
       pago_competencia_total, realizado_total, inadimplencia_total
FROM internal.mv_financeiro_kpis_mes_ano
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_pagamentos_status_ano;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_pagamentos_status_ano;
CREATE MATERIALIZED VIEW internal.mv_pagamentos_status_ano AS
WITH contexto AS (
  SELECT
    p.escola_id,
    COALESCE(m.session_id, CASE
      WHEN p.meta->>'ano_letivo_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (p.meta->>'ano_letivo_id')::uuid
    END) AS ano_letivo_id,
    COALESCE(p.status, 'desconhecido') AS status
  FROM public.pagamentos p
  LEFT JOIN public.mensalidades me
    ON me.id = p.mensalidade_id
   AND me.escola_id = p.escola_id
  LEFT JOIN public.matriculas m
    ON m.id = me.matricula_id
   AND m.escola_id = p.escola_id
)
SELECT
  c.escola_id,
  c.ano_letivo_id,
  al.ano AS ano_letivo,
  c.status,
  COUNT(*)::integer AS total
FROM contexto c
LEFT JOIN public.anos_letivos al
  ON al.id = c.ano_letivo_id
 AND al.escola_id = c.escola_id
GROUP BY c.escola_id, c.ano_letivo_id, al.ano, c.status
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_pagamentos_status_ano
  ON internal.mv_pagamentos_status_ano (escola_id, ano_letivo_id, status);

CREATE VIEW public.vw_pagamentos_status_ano WITH (security_invoker = true) AS
SELECT escola_id, ano_letivo_id, ano_letivo, status, total
FROM internal.mv_pagamentos_status_ano
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_financeiro_inadimplencia_top_ano;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_inadimplencia_top_ano;
CREATE MATERIALIZED VIEW internal.mv_financeiro_inadimplencia_top_ano AS
SELECT
  me.escola_id,
  m.session_id AS ano_letivo_id,
  al.ano AS ano_letivo,
  me.aluno_id,
  COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno sem nome') AS aluno_nome,
  SUM(GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0))::numeric(14,2) AS valor_em_atraso,
  MAX(GREATEST(CURRENT_DATE - me.data_vencimento, 0))::integer AS dias_em_atraso
FROM public.mensalidades me
JOIN public.matriculas m
  ON m.id = me.matricula_id
 AND m.escola_id = me.escola_id
JOIN public.anos_letivos al
  ON al.id = m.session_id
 AND al.escola_id = me.escola_id
JOIN public.alunos a
  ON a.id = me.aluno_id
 AND a.escola_id = me.escola_id
WHERE me.status IN ('pendente','atrasado','parcial','pago_parcial')
  AND me.data_vencimento < CURRENT_DATE
  AND GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0) > 0
GROUP BY me.escola_id, m.session_id, al.ano, me.aluno_id,
         COALESCE(NULLIF(a.nome_completo, ''), NULLIF(a.nome, ''), 'Aluno sem nome')
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_financeiro_inadimplencia_top_ano
  ON internal.mv_financeiro_inadimplencia_top_ano (escola_id, ano_letivo_id, aluno_id);

CREATE VIEW public.vw_financeiro_inadimplencia_top_ano WITH (security_invoker = true) AS
SELECT escola_id, ano_letivo_id, ano_letivo, aluno_id, aluno_nome,
       valor_em_atraso, dias_em_atraso
FROM internal.mv_financeiro_inadimplencia_top_ano
WHERE escola_id = public.current_tenant_escola_id();

DROP VIEW IF EXISTS public.vw_financeiro_dashboard_ano;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_dashboard_ano;
CREATE MATERIALIZED VIEW internal.mv_financeiro_dashboard_ano AS
WITH base AS (
  SELECT
    me.escola_id,
    m.session_id AS ano_letivo_id,
    al.ano AS ano_letivo,
    me.aluno_id,
    me.status,
    me.data_vencimento,
    GREATEST(COALESCE(me.valor_previsto, me.valor, 0) - COALESCE(me.valor_pago_total, 0), 0)::numeric AS saldo,
    COALESCE(me.valor_pago_total, 0)::numeric AS pago
  FROM public.mensalidades me
  JOIN public.matriculas m
    ON m.id = me.matricula_id
   AND m.escola_id = me.escola_id
  JOIN public.anos_letivos al
    ON al.id = m.session_id
   AND al.escola_id = me.escola_id
  WHERE me.status <> 'cancelado'
), alunos AS (
  SELECT escola_id, ano_letivo_id, ano_letivo, aluno_id,
         BOOL_OR(
           data_vencimento < CURRENT_DATE
           AND status IN ('pendente','atrasado','parcial','pago_parcial')
           AND saldo > 0
         ) AS tem_atraso
  FROM base
  GROUP BY escola_id, ano_letivo_id, ano_letivo, aluno_id
)
SELECT
  b.escola_id,
  b.ano_letivo_id,
  b.ano_letivo,
  CURRENT_DATE AS data_referencia,
  SUM(CASE WHEN b.status IN ('pendente','atrasado','parcial','pago_parcial') THEN b.saldo ELSE 0 END)::numeric(14,2) AS total_pendente,
  SUM(b.pago)::numeric(14,2) AS total_pago,
  SUM(CASE WHEN b.data_vencimento < CURRENT_DATE AND b.status IN ('pendente','atrasado','parcial','pago_parcial') THEN b.saldo ELSE 0 END)::numeric(14,2) AS total_inadimplente,
  COUNT(*) FILTER (WHERE b.data_vencimento < CURRENT_DATE AND b.status IN ('pendente','atrasado','parcial','pago_parcial') AND b.saldo > 0)::integer AS mensalidades_inadimplentes,
  COUNT(*)::integer AS mensalidades_total,
  COUNT(*) FILTER (WHERE b.saldo = 0)::integer AS mensalidades_em_dia,
  COUNT(*) FILTER (WHERE b.status IN ('pendente','atrasado','parcial','pago_parcial') AND b.saldo > 0)::integer AS mensalidades_pendentes,
  COUNT(*) FILTER (WHERE b.status <> 'cancelado')::integer AS mensalidades_ativas,
  COUNT(*) FILTER (WHERE b.status IN ('pago','pago_parcial'))::integer AS mensalidades_com_pagamento,
  COUNT(DISTINCT a.aluno_id) FILTER (WHERE a.tem_atraso) AS alunos_inadimplentes,
  COUNT(DISTINCT a.aluno_id) FILTER (WHERE NOT a.tem_atraso) AS alunos_em_dia,
  'synced'::text AS sync_status,
  now() AS sync_updated_at
FROM base b
JOIN alunos a
  ON a.escola_id = b.escola_id
 AND a.ano_letivo_id = b.ano_letivo_id
 AND a.aluno_id = b.aluno_id
GROUP BY b.escola_id, b.ano_letivo_id, b.ano_letivo;

CREATE UNIQUE INDEX ux_mv_financeiro_dashboard_ano
  ON internal.mv_financeiro_dashboard_ano (escola_id, ano_letivo_id);

CREATE VIEW public.vw_financeiro_dashboard_ano WITH (security_invoker = true) AS
SELECT escola_id, ano_letivo_id, ano_letivo, data_referencia,
       total_pendente, total_pago, total_inadimplente,
       mensalidades_inadimplentes, mensalidades_total,
       mensalidades_em_dia, mensalidades_pendentes, mensalidades_ativas,
       mensalidades_com_pagamento, alunos_inadimplentes, alunos_em_dia,
       sync_status, sync_updated_at
FROM internal.mv_financeiro_dashboard_ano
WHERE escola_id = public.current_tenant_escola_id();

CREATE OR REPLACE FUNCTION public.refresh_financeiro_read_models_ano()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_kpis_mes_ano;
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_pagamentos_status_ano;
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_inadimplencia_top_ano;
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_dashboard_ano;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_financeiro_read_models_ano() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_financeiro_read_models_ano() TO service_role;
GRANT SELECT ON internal.mv_financeiro_kpis_mes_ano,
                     internal.mv_pagamentos_status_ano,
                     internal.mv_financeiro_inadimplencia_top_ano,
                     internal.mv_financeiro_dashboard_ano
TO authenticated, service_role;
GRANT SELECT ON public.vw_financeiro_kpis_mes_ano,
                     public.vw_pagamentos_status_ano,
                     public.vw_financeiro_inadimplencia_top_ano,
                     public.vw_financeiro_dashboard_ano
TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_financeiro_read_models_ano') THEN
    PERFORM cron.schedule(
      'refresh_financeiro_read_models_ano',
      '*/10 * * * *',
      $job$SELECT public.refresh_financeiro_read_models_ano()$job$
    );
  END IF;
END;
$$;

REFRESH MATERIALIZED VIEW internal.mv_financeiro_kpis_mes_ano;
REFRESH MATERIALIZED VIEW internal.mv_pagamentos_status_ano;
REFRESH MATERIALIZED VIEW internal.mv_financeiro_inadimplencia_top_ano;
REFRESH MATERIALIZED VIEW internal.mv_financeiro_dashboard_ano;

COMMIT;
