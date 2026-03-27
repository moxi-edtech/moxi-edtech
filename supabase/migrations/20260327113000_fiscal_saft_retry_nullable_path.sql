-- Permite política de reexportação (safe overwrite): limpar caminho do ficheiro antes de reprocessar
ALTER TABLE public.fiscal_saft_exports
  ALTER COLUMN arquivo_storage_path DROP NOT NULL;
