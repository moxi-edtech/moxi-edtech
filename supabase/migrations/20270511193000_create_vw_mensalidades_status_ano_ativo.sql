CREATE OR REPLACE VIEW public.vw_mensalidades_status_ano_ativo
WITH (security_invoker = true) AS
SELECT
  m.escola_id,
  COALESCE(m.status, 'desconhecido') AS status,
  COUNT(*)::integer AS total
FROM public.mensalidades m
JOIN public.anos_letivos al
  ON al.escola_id = m.escola_id
 AND al.ativo = true
 AND m.ano_referencia = al.ano
GROUP BY m.escola_id, COALESCE(m.status, 'desconhecido');

GRANT ALL ON TABLE public.vw_mensalidades_status_ano_ativo TO authenticated, service_role;
