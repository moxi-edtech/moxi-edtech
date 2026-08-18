-- Visão consolidada do caixa recebido no mês.
-- Não mistura caixa com competência: pagamentos antigos e serviços entram
-- no caixa, mas não alteram o percentual da competência mensal.
DROP VIEW IF EXISTS public.vw_financeiro_caixa_mes;
DROP MATERIALIZED VIEW IF EXISTS internal.mv_financeiro_caixa_mes;

CREATE MATERIALIZED VIEW internal.mv_financeiro_caixa_mes AS
WITH recebimentos AS (
  SELECT
    p.escola_id,
    date_trunc('month', p.data_pagamento)::date AS mes_ref,
    CASE
      WHEN p.mensalidade_id IS NULL THEN 'servicos'
      WHEN date_trunc('month', m.data_vencimento)::date < date_trunc('month', p.data_pagamento)::date
        THEN 'dividas_anteriores'
      ELSE 'mensalidades'
    END AS categoria,
    COALESCE(p.valor_pago, 0)::numeric(14,2) AS valor
  FROM public.pagamentos p
  LEFT JOIN public.mensalidades m
    ON m.id = p.mensalidade_id
   AND m.escola_id = p.escola_id
  WHERE p.data_pagamento IS NOT NULL
    AND p.status IN ('pago', 'concluido', 'settled', 'liquidado')
)
SELECT
  escola_id,
  mes_ref,
  SUM(valor)::numeric(14,2) AS recebido_total,
  SUM(valor) FILTER (WHERE categoria = 'mensalidades')::numeric(14,2) AS mensalidades_total,
  SUM(valor) FILTER (WHERE categoria = 'dividas_anteriores')::numeric(14,2) AS dividas_anteriores_total,
  SUM(valor) FILTER (WHERE categoria = 'servicos')::numeric(14,2) AS servicos_total,
  COUNT(*)::integer AS recebimentos_total
FROM recebimentos
GROUP BY escola_id, mes_ref
WITH NO DATA;

CREATE UNIQUE INDEX ux_mv_financeiro_caixa_mes
  ON internal.mv_financeiro_caixa_mes (escola_id, mes_ref);

-- A primeira carga não pode usar CONCURRENTLY numa MV criada WITH NO DATA.
REFRESH MATERIALIZED VIEW internal.mv_financeiro_caixa_mes;

CREATE VIEW public.vw_financeiro_caixa_mes WITH (security_invoker = true) AS
SELECT escola_id, mes_ref, recebido_total, mensalidades_total,
       dividas_anteriores_total, servicos_total, recebimentos_total
FROM internal.mv_financeiro_caixa_mes
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
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.mv_financeiro_caixa_mes;
END;
$$;

GRANT SELECT ON public.vw_financeiro_caixa_mes TO authenticated, service_role;
