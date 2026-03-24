BEGIN;

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_empresa_invoice_numero
  ON public.fiscal_documentos (empresa_id, invoice_date DESC, numero DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_empresa_system_entry
  ON public.fiscal_documentos (empresa_id, system_entry DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_eventos_empresa_tipo_created
  ON public.fiscal_documentos_eventos (empresa_id, tipo_evento, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_eventos_empresa_created
  ON public.fiscal_documentos_eventos (empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_eventos_payload_gin
  ON public.fiscal_documentos_eventos
  USING gin (payload jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_fiscal_saft_exports_empresa_status_created
  ON public.fiscal_saft_exports (empresa_id, status, created_at DESC);

COMMIT;
