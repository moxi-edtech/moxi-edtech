CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_documento_origem
  ON public.fiscal_documentos(documento_origem_id)
  WHERE documento_origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_documentos_rectifica_documento
  ON public.fiscal_documentos(rectifica_documento_id)
  WHERE rectifica_documento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiscal_agt_submission_documentos_empresa
  ON public.fiscal_agt_submission_documentos(empresa_id);
