BEGIN;

CREATE INDEX IF NOT EXISTS idx_fiscal_series_semantic_lookup_active
  ON public.fiscal_series (empresa_id, tipo_documento, prefixo, origem_documento)
  WHERE ativa = true AND descontinuada_em IS NULL;

COMMIT;
