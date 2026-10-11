BEGIN;

ALTER TABLE public.financeiro_itens
  ADD COLUMN IF NOT EXISTS tax_profile_code text NULL;

ALTER TABLE public.financeiro_tabelas
  ADD COLUMN IF NOT EXISTS tax_profile_code text NULL;

UPDATE public.financeiro_tabelas
SET tax_profile_code='IVA_EDUCACAO_M21'
WHERE tax_profile_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_itens_tax_profile
  ON public.financeiro_itens(tax_profile_code)
  WHERE tax_profile_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_tabelas_tax_profile
  ON public.financeiro_tabelas(tax_profile_code)
  WHERE tax_profile_code IS NOT NULL;

COMMIT;