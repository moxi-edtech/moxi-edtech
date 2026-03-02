-- Metadata para rastrear origem da criação automática de assinaturas
ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS origem_registo TEXT,
  ADD COLUMN IF NOT EXISTS motivo_origem TEXT;

COMMENT ON COLUMN public.assinaturas.origem_registo IS 'Origem operacional do registo (ex.: sync_bootstrap, manual, import).';
COMMENT ON COLUMN public.assinaturas.motivo_origem IS 'Motivo da criação automática para revisão do Super Admin.';

