CREATE OR REPLACE VIEW public.vw_mensalidades_operacional_status_ano_ativo
WITH (security_invoker = true) AS
SELECT
  m.escola_id,
  CASE
    WHEN COALESCE(m.status, '') IN ('pago', 'pago_parcial') THEN 'pago'
    WHEN COALESCE(m.status, '') IN ('pendente', 'parcial', 'atrasado')
      AND m.data_vencimento < CURRENT_DATE THEN 'inadimplente'
    WHEN COALESCE(m.status, '') IN ('pendente', 'parcial', 'atrasado') THEN 'pendente'
    ELSE 'outros'
  END AS status_operacional,
  COUNT(*)::integer AS total
FROM public.mensalidades m
JOIN public.anos_letivos al
  ON al.escola_id = m.escola_id
 AND al.ativo = true
 AND m.ano_referencia = al.ano
GROUP BY m.escola_id, 2;

GRANT ALL ON TABLE public.vw_mensalidades_operacional_status_ano_ativo TO authenticated, service_role;
