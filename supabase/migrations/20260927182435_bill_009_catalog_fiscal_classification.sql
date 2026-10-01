BEGIN;

ALTER TABLE public.financeiro_itens
  ADD COLUMN IF NOT EXISTS fiscal_product_type text NULL,
  ADD COLUMN IF NOT EXISTS fiscal_operation_type text NULL;

ALTER TABLE public.financeiro_itens
  DROP CONSTRAINT IF EXISTS financeiro_itens_fiscal_product_type_chk,
  DROP CONSTRAINT IF EXISTS financeiro_itens_fiscal_operation_type_chk;

ALTER TABLE public.financeiro_itens
  ADD CONSTRAINT financeiro_itens_fiscal_product_type_chk
  CHECK (fiscal_product_type IS NULL OR fiscal_product_type IN ('P','S','O','E','I')),
  ADD CONSTRAINT financeiro_itens_fiscal_operation_type_chk
  CHECK (
    fiscal_operation_type IS NULL
    OR fiscal_operation_type IN ('SE','SS','STP','SR','SIF','SHS','ST','SG','TB','AS','QT','RD')
  );

COMMIT;