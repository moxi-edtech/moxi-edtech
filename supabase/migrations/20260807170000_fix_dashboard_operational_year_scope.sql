BEGIN;

-- O ano civil da competência não substitui o ano letivo da matrícula.
-- Janeiro/2026, por exemplo, pertence a uma matrícula 2025/2026.
CREATE OR REPLACE VIEW public.vw_mensalidades_operacional_status_ano_ativo
WITH (security_invoker = true)
AS
SELECT
  m.escola_id,
  CASE
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pago', 'pago_parcial']) THEN 'pago'
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pendente', 'parcial', 'atrasado'])
      AND m.data_vencimento < CURRENT_DATE THEN 'inadimplente'
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pendente', 'parcial', 'atrasado']) THEN 'pendente'
    ELSE 'outros'
  END AS status_operacional,
  count(*)::integer AS total
FROM public.mensalidades m
JOIN public.anos_letivos al
  ON al.escola_id = m.escola_id
 AND al.ativo = true
 AND m.ano_letivo = al.ano::text
GROUP BY
  m.escola_id,
  CASE
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pago', 'pago_parcial']) THEN 'pago'
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pendente', 'parcial', 'atrasado'])
      AND m.data_vencimento < CURRENT_DATE THEN 'inadimplente'
    WHEN COALESCE(m.status, '') = ANY (ARRAY['pendente', 'parcial', 'atrasado']) THEN 'pendente'
    ELSE 'outros'
  END;

COMMIT;
