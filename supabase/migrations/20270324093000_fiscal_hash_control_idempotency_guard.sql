BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_fiscal_documentos_empresa_hash_control
  ON public.fiscal_documentos (empresa_id, hash_control);

COMMIT;
