BEGIN;

ALTER TABLE public.financeiro_tabelas
  ALTER COLUMN tax_profile_code SET DEFAULT 'IVA_EDUCACAO_M21';

UPDATE public.financeiro_tabelas
SET tax_profile_code='IVA_EDUCACAO_M21'
WHERE tax_profile_code IS NULL;

ALTER TABLE public.financeiro_tabelas
  ALTER COLUMN tax_profile_code SET NOT NULL;

COMMIT;