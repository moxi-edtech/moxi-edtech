-- Canonical, idempotent reenrollment order: tenant + pupil + destination year.
-- Partial index permits canceled/failed historical attempts and excludes
-- legacy orders without a confirmed academic-year ID (they require reconciliation).
CREATE UNIQUE INDEX IF NOT EXISTS uq_servico_pedidos_rematricula_active_year
ON public.servico_pedidos (escola_id, aluno_id, (contexto ->> 'ano_letivo_id'))
WHERE servico_codigo = 'SERV_REMATRICULA'
  AND status IN ('pending_payment', 'granted')
  AND NULLIF(contexto ->> 'ano_letivo_id', '') IS NOT NULL;
